import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Comprobante,
  Pago,
  Usuario,
  Membresia,
  ReservaCancha,
} from '../entities';
import {
  EstadoPago,
  MetodoPago,
  TipoActor,
  TipoPlan,
  EstadoResCancha,
  EstadoMembresia,
} from '../entities/enums';
import { PASARELA_PAGO, type PasarelaPago } from './pasarela-pago.interface';
import { ComprobantesService } from './comprobantes.service';
import { PreciosService } from '../precios/precios.service';
import { MembresiasService } from '../membresias/membresias.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { RegistrarPagoEfectivoDto } from './dto/registrar-pago-efectivo.dto';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ClientesCobroQueryDto } from './dto/clientes-cobro-query.dto';
import { escaparLike } from '../common/helpers/like.helper';
import type { PaginatedResponse } from '../common/types/paginated-response.type';

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    @InjectRepository(ReservaCancha)
    private readonly reservasCanchaRepo: Repository<ReservaCancha>,
    @Inject(PASARELA_PAGO)
    private readonly pasarela: PasarelaPago,
    private readonly comprobantes: ComprobantesService,
    private readonly preciosService: PreciosService,
    private readonly membresiasService: MembresiasService,
    private readonly dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  // Genera el comprobante y lo deja en `pago.comprobante` para que la respuesta
  // lo incluya (el cliente lo necesita para mostrar el enlace). Se copian solo
  // los campos propios: la entidad trae `pago` y crearía una referencia circular
  // al serializar.
  private async generarYAdjuntar(
    pago: Pago,
    manager?: EntityManager,
  ): Promise<void> {
    const c = await this.comprobantes.generar(pago, manager);
    if (c?.id) {
      pago.comprobante = {
        id: c.id,
        pdfPath: c.pdfPath,
        generadoEn: c.generadoEn,
      } as Comprobante;
    }
  }

  // Sede de quien cobra. Fail-closed: sin sede asignada no se lista nada.
  private sedeDeCobro(currentUser: UsuarioAutenticado): string {
    if (!currentUser.sedeId) {
      throw new ForbiddenException('Tu usuario no tiene una sede asignada');
    }
    return currentUser.sedeId;
  }

  // Socios y externos activos "de la sede": con la sede asignada, con una
  // membresía dada de alta en ella o con una reserva de cancha confirmada en
  // ella. Se resuelve en la base, paginado, y devuelve solo lo necesario para
  // identificar a quién se cobra (sin email, teléfono ni datos de cuenta).
  async listarClientesParaCobro(
    query: ClientesCobroQueryDto,
    currentUser: UsuarioAutenticado,
  ): Promise<
    PaginatedResponse<{
      id: string;
      nombre: string;
      apellido: string;
      dni: string | null;
      tipoActor: string;
    }>
  > {
    const sedeId = this.sedeDeCobro(currentUser);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 20);

    const params: unknown[] = [sedeId, EstadoResCancha.CONFIRMADA];
    let filtroTexto = '';
    const texto = (query.q ?? '').trim();
    if (texto) {
      params.push(`%${escaparLike(texto)}%`);
      filtroTexto = `AND (u.nombre ILIKE $3 OR u.apellido ILIKE $3 OR u.dni ILIKE $3 OR (u.nombre || ' ' || u.apellido) ILIKE $3)`;
    }
    const desde = `
      FROM usuarios u
      WHERE u.tipo_actor IN ('SOCIO', 'EXTERNO')
        AND u.activo
        AND (
          u.sede_id = $1
          OR EXISTS (SELECT 1 FROM membresias m WHERE m.usuario_id = u.id AND m.sede_alta_id = $1)
          OR EXISTS (
            SELECT 1 FROM reservas_cancha r
            JOIN canchas c ON c.id = r.cancha_id
            WHERE r.usuario_id = u.id AND c.sede_id = $1 AND r.estado = $2
          )
        )
        ${filtroTexto}`;

    const [{ total }] = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total ${desde}`,
      params,
    );
    const filas = await this.dataSource.query<
      {
        id: string;
        nombre: string;
        apellido: string;
        dni: string | null;
        tipo_actor: string;
      }[]
    >(
      `SELECT u.id, u.nombre, u.apellido, u.dni, u.tipo_actor::text AS tipo_actor ${desde}
       ORDER BY lower(u.apellido), lower(u.nombre), u.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    const totalNum = Number(total);
    return {
      data: filas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        apellido: f.apellido,
        dni: f.dni,
        tipoActor: f.tipo_actor,
      })),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit) || 1,
    };
  }

  // Reservas de cancha confirmadas de UN cliente, solo de canchas de la sede
  // de quien cobra (acotar por cliente evita barrer toda la tabla).
  async reservasCanchaParaCobro(
    usuarioId: string,
    currentUser: UsuarioAutenticado,
  ) {
    const sedeId = this.sedeDeCobro(currentUser);
    const reservas = await this.reservasCanchaRepo.find({
      where: {
        estado: EstadoResCancha.CONFIRMADA,
        usuario: { id: usuarioId },
        cancha: { sede: { id: sedeId } },
      },
      relations: { cancha: { sede: true } },
      order: { fecha: 'ASC', horaInicio: 'ASC' },
      take: 50,
    });
    return reservas.map((r) => ({
      id: r.id,
      estado: r.estado,
      fecha: r.fecha,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      precioFinal: r.precioFinal,
      cancha: {
        nombre: r.cancha.nombre,
        sede: { id: r.cancha.sede.id, nombre: r.cancha.sede.nombre },
      },
    }));
  }

  private async resolverReferencia(dto: {
    usuarioId: string;
    plan?: TipoPlan;
    membresiaId?: string;
    reservaClaseId?: string;
    reservaCanchaId?: string;
  }): Promise<{
    plan?: TipoPlan;
    membresia?: Membresia;
    reservaCancha?: ReservaCancha;
  }> {
    // Las clases no son cobrables de forma independiente (RN-03): el
    // acceso viene incluido en la membresía. Se rechaza explícito en
    // vez de ignorarse, para que el error sea visible vía API directa.
    if (dto.reservaClaseId) {
      throw new BadRequestException(
        'Las reservas de clase no son cobrables de forma independiente: el acceso está incluido en la membresía',
      );
    }
    const referencias = [dto.plan, dto.membresiaId, dto.reservaCanchaId].filter(
      Boolean,
    );
    if (referencias.length !== 1) {
      throw new BadRequestException(
        'Debe indicarse exactamente una referencia: plan, membresiaId o reservaCanchaId',
      );
    }

    if (dto.reservaCanchaId) {
      const reservaCancha = await this.reservasCanchaRepo.findOne({
        where: { id: dto.reservaCanchaId },
      });
      if (!reservaCancha)
        throw new NotFoundException(
          `Reserva de cancha ${dto.reservaCanchaId} no encontrada`,
        );
      return { reservaCancha };
    }

    // Flujo membresía: el cliente manda el plan (nunca un monto); por
    // compatibilidad también se acepta membresiaId y se deriva su plan.
    if (dto.membresiaId) {
      const previa = await this.membresiasRepo.findOne({
        where: { id: dto.membresiaId },
        relations: { usuario: true },
      });
      if (!previa)
        throw new NotFoundException(
          `Membresía ${dto.membresiaId} no encontrada`,
        );
      if (previa.usuario.id !== dto.usuarioId) {
        throw new BadRequestException(
          'La membresía no pertenece al usuario indicado',
        );
      }
      return { plan: previa.plan, membresia: previa };
    }
    return { plan: dto.plan };
  }

  private async calcularMonto(
    montoRecibido: number | undefined,
    referencia: {
      plan?: TipoPlan;
      reservaCancha?: ReservaCancha;
    },
  ): Promise<number> {
    // El precio de una membresía sale siempre del servidor
    // (preciosService); el cliente nunca manda un monto para esto.
    if (referencia.plan) {
      return this.preciosService.obtenerPrecio(referencia.plan);
    }
    if (referencia.reservaCancha) {
      return Number(referencia.reservaCancha.precioFinal);
    }
    if (montoRecibido === undefined) {
      throw new BadRequestException(
        'Debe indicarse el monto para este tipo de pago',
      );
    }
    return montoRecibido;
  }

  private async obtenerSedeDeReferencia(referencia: {
    membresia?: Membresia;
    reservaCancha?: ReservaCancha;
  }): Promise<string | null> {
    if (referencia.membresia) {
      const m = await this.membresiasRepo.findOne({
        where: { id: referencia.membresia.id },
        relations: { sedeAlta: true },
      });
      return m?.sedeAlta.id ?? null;
    }
    if (referencia.reservaCancha) {
      const r = await this.reservasCanchaRepo.findOne({
        where: { id: referencia.reservaCancha.id },
        relations: { cancha: { sede: true } },
      });
      return r?.cancha.sede.id ?? null;
    }
    return null;
  }

  async pagarConPasarela(dto: CreatePagoDto): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const referencia = await this.resolverReferencia(dto);
    const monto = await this.calcularMonto(dto.monto, referencia);

    const { aprobado, token } = await this.pasarela.procesarPago(
      monto,
      dto.metodo,
      dto.simularRechazo ?? false,
    );

    const datosPago = {
      usuario,
      membresia: referencia.membresia,
      reservaCancha: referencia.reservaCancha,
      metodo: dto.metodo,
      monto: String(monto),
      tokenPasarela: token,
      estado: aprobado ? EstadoPago.APROBADO : EstadoPago.RECHAZADO,
      pagadoEn: aprobado ? new Date() : undefined,
    };

    // Rechazado: se registra el intento y el rol no cambia.
    if (!aprobado) {
      return this.pagosRepo.save(this.pagosRepo.create(datosPago));
    }

    // Aprobado: pago y promoción EXTERNO → SOCIO en la misma transacción.
    const { guardado, promovidoId } = await this.dataSource.transaction(
      async (manager) => {
        const pagosRepoTx = manager.getRepository(Pago);
        const pago = await pagosRepoTx.save(pagosRepoTx.create(datosPago));
        const promovido = await this.promoverExternoASocioSiCorresponde(
          manager,
          pago,
        );
        return { guardado: pago, promovidoId: promovido };
      },
    );
    if (promovidoId) {
      await this.auditarPromocion(promovidoId, guardado.id, usuario.id);
    }

    await this.generarYAdjuntar(guardado);
    return guardado;
  }

  // ADR 0011: pagar una membresía convierte al titular EXTERNO en SOCIO.
  // Es el único punto que cambia ese rol por un pago; lo usan todos los
  // caminos que dejan un pago de membresía APROBADO. El usuario promovido
  // es el titular de la membresía, nunca quien ejecuta el cobro. El UPDATE
  // es condicional (solo si sigue siendo EXTERNO): si ya es SOCIO, o es
  // cualquier otro rol, no toca nada. Devuelve el id promovido o null.
  private async promoverExternoASocioSiCorresponde(
    manager: EntityManager,
    pago: Pago,
  ): Promise<string | null> {
    if (pago.estado !== EstadoPago.APROBADO || !pago.membresia) return null;
    const membresia = await manager.getRepository(Membresia).findOne({
      where: { id: pago.membresia.id },
      relations: { usuario: true },
    });
    const titular = membresia?.usuario;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (!titular || titular.tipoActor !== TipoActor.EXTERNO) return null;
    const res = await manager
      .getRepository(Usuario)
      .update(
        { id: titular.id, tipoActor: TipoActor.EXTERNO },
        { tipoActor: TipoActor.SOCIO },
      );
    return res.affected ? titular.id : null;
  }

  // Se registra después del commit (AuditoriaService usa su propio
  // repositorio y no propaga errores).
  private async auditarPromocion(
    usuarioId: string,
    pagoId: string,
    actorId?: string,
  ): Promise<void> {
    await this.auditoria.registrar({
      actorId,
      accion: 'PROMOVER_EXTERNO_A_SOCIO',
      entidad: 'Usuario',
      entidadId: usuarioId,
      detalle: {
        motivo: 'EXTERNO → SOCIO por pago de membresía',
        pagoId,
      },
    });
  }

  async registrarPagoEfectivo(
    dto: RegistrarPagoEfectivoDto,
    registradoPorId: string,
  ): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const registradoPor = await this.usuariosRepo.findOne({
      where: { id: registradoPorId },
      relations: { sede: true },
    });
    if (!registradoPor)
      throw new NotFoundException(`Usuario ${registradoPorId} no encontrado`);

    if (
      registradoPor.tipoActor !== TipoActor.RECEPCIONISTA &&
      registradoPor.tipoActor !== TipoActor.GERENTE_SEDE &&
      registradoPor.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      throw new BadRequestException(
        'Solo un recepcionista o gerente puede registrar un pago en efectivo',
      );
    }

    const referencia = await this.resolverReferencia(dto);

    // Flujo cancha: igual que antes (sin cambios de membresía).
    if (referencia.reservaCancha) {
      const monto = await this.calcularMonto(dto.monto, referencia);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (
        registradoPor.tipoActor === TipoActor.RECEPCIONISTA ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        registradoPor.tipoActor === TipoActor.GERENTE_SEDE
      ) {
        const sedeDeLaOperacion =
          await this.obtenerSedeDeReferencia(referencia);
        if (sedeDeLaOperacion) {
          const currentUser: UsuarioAutenticado = {
            id: registradoPor.id,
            tipoActor: registradoPor.tipoActor,
            email: registradoPor.email ?? '',
            sedeId: registradoPor.sede?.id ?? null,
          };
          assertSedeScope(currentUser, sedeDeLaOperacion);
        }
      }

      return this.dataSource.transaction(async (manager) => {
        const pagosRepoTx = manager.getRepository(Pago);
        const pago = pagosRepoTx.create({
          usuario,
          registradoPor,
          reservaCancha: referencia.reservaCancha,
          metodo: MetodoPago.EFECTIVO,
          monto: String(monto),
          estado: EstadoPago.APROBADO,
          pagadoEn: new Date(),
        });
        const guardado = await pagosRepoTx.save(pago);
        await this.generarYAdjuntar(guardado, manager);
        return guardado;
      });
    }

    // Flujo membresía: el precio sale del servidor según el plan.
    const plan = referencia.plan as TipoPlan;
    const monto = await this.preciosService.obtenerPrecio(plan);
    const vigente = await this.membresiasService.obtenerMembresiaVigente(
      dto.usuarioId,
    );
    const esRenovacion = vigente?.estado === EstadoMembresia.ACTIVO;

    // Sede de alta de la membresía resultante: la del que cobra; si es
    // GG (sin sede), la de la membresía anterior. Sin ninguna fuente,
    // no se puede inventar una sede: se rechaza explícito.
    const sedeAltaId = esRenovacion
      ? vigente!.sedeAlta.id
      : (registradoPor.sede?.id ?? vigente?.sedeAlta.id ?? null);
    if (!sedeAltaId) {
      throw new BadRequestException(
        'No se pudo determinar la sede de alta: indicá una sede para el cobro',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (
      registradoPor.tipoActor === TipoActor.RECEPCIONISTA ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      registradoPor.tipoActor === TipoActor.GERENTE_SEDE
    ) {
      const currentUser: UsuarioAutenticado = {
        id: registradoPor.id,
        tipoActor: registradoPor.tipoActor,
        email: registradoPor.email ?? '',
        sedeId: registradoPor.sede?.id ?? null,
      };
      assertSedeScope(currentUser, sedeAltaId);
    }

    // Todo en una sola transacción: membresía, Pago APROBADO y
    // comprobante. Si algo falla, no queda nada a medias.
    const { guardado, promovidoId } = await this.dataSource.transaction(
      async (manager) => {
        const membresiaResultante = esRenovacion
          ? await this.membresiasService.renovar(
              { usuarioId: dto.usuarioId, sedeAltaId, plan },
              manager,
            )
          : await this.membresiasService.create(
              { usuarioId: dto.usuarioId, sedeAltaId, plan },
              manager,
            );
        const pagosRepoTx = manager.getRepository(Pago);
        const pago = pagosRepoTx.create({
          usuario,
          registradoPor,
          membresia: membresiaResultante,
          metodo: MetodoPago.EFECTIVO,
          monto: String(monto),
          estado: EstadoPago.APROBADO,
          pagadoEn: new Date(),
        });
        const guardado = await pagosRepoTx.save(pago);
        const promovidoId = await this.promoverExternoASocioSiCorresponde(
          manager,
          guardado,
        );
        await this.generarYAdjuntar(guardado, manager);
        return { guardado, promovidoId };
      },
    );
    if (promovidoId) {
      await this.auditarPromocion(promovidoId, guardado.id, registradoPor.id);
    }
    return guardado;
  }

  async findPorUsuario(
    usuarioId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Pago>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.pagosRepo.findAndCount({
      where: { usuario: { id: usuarioId } },
      relations: { comprobante: true, registradoPor: true },
      order: { creadoEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, currentUser: UsuarioAutenticado): Promise<Pago> {
    const pago = await this.pagosRepo.findOne({
      where: { id },
      relations: { comprobante: true, usuario: true, registradoPor: true },
    });
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
    assertOwnerOrStaff(currentUser, pago.usuario.id);
    return pago;
  }
}
