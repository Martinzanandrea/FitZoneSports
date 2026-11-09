import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
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
import { CobrarCanchaPresencialDto } from './dto/cobrar-cancha-presencial.dto';
import { ReservasCanchaService } from '../canchas/reserva-cancha.service';
import { escaparLike } from '../common/helpers/like.helper';
import { puedeVerPago } from './historial-pagos.service';
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
    private readonly reservasCancha: ReservasCanchaService,
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
    // Solo confirmadas SIN pago aprobado (las ya cobradas no son "pendientes").
    const reservas = await this.reservasCanchaRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.cancha', 'c')
      .innerJoinAndSelect('c.sede', 's')
      .where('r.estado = :estado', { estado: EstadoResCancha.CONFIRMADA })
      .andWhere('r.usuario_id = :usuarioId', { usuarioId })
      .andWhere('s.id = :sedeId', { sedeId })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM pagos p WHERE p.reserva_cancha_id = r.id AND p.estado = :aprobado)`,
        { aprobado: EstadoPago.APROBADO },
      )
      .orderBy('r.fecha', 'ASC')
      .addOrderBy('r.hora_inicio', 'ASC')
      .take(50)
      .getMany();
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

  // `actorId` es el usuario del JWT. Los pagos de cancha exigen que la reserva
  // sea suya (el controlador siempre lo pasa).
  async pagarConPasarela(dto: CreatePagoDto, actorId?: string): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const referencia = await this.resolverReferencia(dto);
    if (referencia.reservaCancha) {
      return this.pagarCanchaConPasarela(
        dto,
        usuario,
        referencia.reservaCancha.id,
        actorId,
      );
    }

    // Membresía: NO existe antes del pago. La crea (o renueva) esta misma
    // operación, en la misma transacción que el pago APROBADO. Un rechazo no
    // deja membresía alguna.
    if (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      usuario.tipoActor !== TipoActor.SOCIO &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      usuario.tipoActor !== TipoActor.EXTERNO
    ) {
      throw new BadRequestException(
        'Solo un socio o un cliente externo puede pagar una membresía',
      );
    }
    const plan = referencia.plan as TipoPlan;
    const monto = await this.calcularMonto(dto.monto, referencia);
    // Con una membresía ya programada se rechaza ANTES de cobrar (409).
    await this.membresiasService.asegurarSinProxima(usuario.id);
    // Con una vigente, la nueva queda en la misma sede; sin vigente, la sede
    // elegida o la de la última membresía.
    const vigente = await this.membresiasService.obtenerMembresiaVigente(
      usuario.id,
    );
    const previa =
      vigente ??
      (await this.membresiasService.obtenerUltimaMembresia(usuario.id));
    const sedeAltaId = vigente
      ? vigente.sedeAlta.id
      : (dto.sedeAltaId ?? previa?.sedeAlta.id ?? null);
    if (!sedeAltaId) {
      throw new BadRequestException('Indicá la sede de alta (sedeAltaId)');
    }

    const { aprobado, token } = await this.pasarela.procesarPago(
      monto,
      dto.metodo,
      dto.simularRechazo ?? false,
    );

    if (!aprobado) {
      // Sin membresía no hay a qué atar el pago (la base exige una referencia),
      // así que el intento se audita y se devuelve sin persistir.
      await this.auditoria.registrar({
        actorId: actorId ?? usuario.id,
        accion: 'PAGO_RECHAZADO',
        entidad: 'Usuario',
        entidadId: usuario.id,
        detalle: { plan, metodo: dto.metodo, monto },
      });
      return {
        estado: EstadoPago.RECHAZADO,
        metodo: dto.metodo,
        monto: String(monto),
        creadoEn: new Date(),
      } as Pago;
    }

    const { guardado, promovidoId } = await this.dataSource.transaction(
      (manager) =>
        this.cobrarMembresiaEnTransaccion(manager, {
          usuario,
          plan,
          sedeAltaId,
          monto,
          metodo: dto.metodo,
          tokenPasarela: token,
        }),
    );
    if (promovidoId) {
      await this.auditarPromocion(promovidoId, guardado.id, usuario.id);
    }

    await this.generarYAdjuntar(guardado);
    return guardado;
  }

  // Única vía para dejar una membresía ACTIVO: la membresía (nueva o renovada) y
  // el pago APROBADO se guardan juntos en la transacción del llamador.
  private async cobrarMembresiaEnTransaccion(
    manager: EntityManager,
    d: {
      usuario: Usuario;
      plan: TipoPlan;
      sedeAltaId: string;
      monto: number;
      metodo: MetodoPago;
      registradoPor?: Usuario;
      tokenPasarela?: string;
    },
  ): Promise<{ guardado: Pago; promovidoId: string | null }> {
    const dtoMembresia = {
      usuarioId: d.usuario.id,
      sedeAltaId: d.sedeAltaId,
      plan: d.plan,
    };
    const membresia = await this.membresiasService.alta(dtoMembresia, manager);
    const pagosRepoTx = manager.getRepository(Pago);
    const guardado = await pagosRepoTx.save(
      pagosRepoTx.create({
        usuario: d.usuario,
        registradoPor: d.registradoPor,
        membresia,
        metodo: d.metodo,
        monto: String(d.monto),
        tokenPasarela: d.tokenPasarela,
        estado: EstadoPago.APROBADO,
        pagadoEn: new Date(),
      }),
    );
    const promovidoId = await this.promoverExternoASocioSiCorresponde(
      manager,
      guardado,
    );
    return { guardado, promovidoId };
  }

  // Cobro online de una reserva de cancha existente. Misma protección que el
  // cobro en efectivo: una transacción con la fila de la reserva bloqueada, así
  // un doble clic o dos pestañas se serializan y la segunda ve el pago ya hecho.
  // Nota: la pasarela se llama con el lock tomado a propósito (es lo que impide
  // el doble cobro); con una pasarela real habría que acotar su timeout.
  private async pagarCanchaConPasarela(
    dto: CreatePagoDto,
    usuario: Usuario,
    reservaId: string,
    actorId?: string,
  ): Promise<Pago> {
    const guardado = await this.dataSource.transaction(async (manager) => {
      const reserva = await manager
        .getRepository(ReservaCancha)
        .createQueryBuilder('r')
        .innerJoinAndSelect('r.usuario', 'u')
        .setLock('pessimistic_write', undefined, ['r'])
        .where('r.id = :id', { id: reservaId })
        .getOne();
      // Debe ser del usuario del JWT (y del usuarioId indicado): si no, para
      // el cliente es como si no existiera.
      if (
        !reserva ||
        reserva.usuario.id !== usuario.id ||
        (actorId !== undefined && reserva.usuario.id !== actorId)
      ) {
        throw new NotFoundException('Reserva de cancha no encontrada');
      }
      if (reserva.estado !== EstadoResCancha.CONFIRMADA) {
        throw new ConflictException('La reserva no está confirmada');
      }
      const pagosRepoTx = manager.getRepository(Pago);
      const yaPagada = await pagosRepoTx.exists({
        where: {
          reservaCancha: { id: reservaId },
          estado: EstadoPago.APROBADO,
        },
      });
      if (yaPagada) {
        throw new ConflictException(
          'La reserva ya tiene un pago aprobado: no se puede cobrar de nuevo',
        );
      }
      // El monto sale de la reserva, nunca del cliente.
      const monto = Number(reserva.precioFinal);
      const { aprobado, token } = await this.pasarela.procesarPago(
        monto,
        dto.metodo,
        dto.simularRechazo ?? false,
      );
      return pagosRepoTx.save(
        pagosRepoTx.create({
          usuario,
          reservaCancha: reserva,
          metodo: dto.metodo,
          monto: String(monto),
          tokenPasarela: token,
          estado: aprobado ? EstadoPago.APROBADO : EstadoPago.RECHAZADO,
          pagadoEn: aprobado ? new Date() : undefined,
        }),
      );
    });
    if (guardado.estado === EstadoPago.APROBADO) {
      await this.generarYAdjuntar(guardado);
    }
    return guardado;
  }

  // Genera bajo demanda el comprobante de un pago APROBADO que no lo tiene.
  // Idempotente: con la fila del pago bloqueada, si ya existe devuelve el
  // existente en vez de crear otro.
  // Con `regenerar`, si ya existe rehace el PDF con el diseño actual y actualiza
  // ese mismo registro (sin duplicar); el archivo anterior se borra al confirmar.
  async generarComprobanteBajoDemanda(
    pagoId: string,
    user: UsuarioAutenticado,
    regenerar = false,
  ): Promise<{ id: string; generadoEn: Date; creado: boolean }> {
    let anterior: string | null = null;
    const resultado = await this.dataSource.transaction(async (manager) => {
      const bloqueado = await manager
        .getRepository(Pago)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: pagoId })
        .getOne();
      if (!bloqueado) throw new NotFoundException('Pago no encontrado');
      const pago = await manager.getRepository(Pago).findOne({
        where: { id: pagoId },
        relations: {
          usuario: true,
          registradoPor: true,
          membresia: { sedeAlta: true },
          reservaCancha: { cancha: { sede: true } },
        },
      });
      if (!pago) throw new NotFoundException('Pago no encontrado');
      const sedeId =
        pago.membresia?.sedeAlta?.id ??
        pago.reservaCancha?.cancha?.sede?.id ??
        null;
      if (!puedeVerPago(user, { usuarioId: pago.usuario.id, sedeId })) {
        throw new NotFoundException('Pago no encontrado');
      }
      if (pago.estado !== EstadoPago.APROBADO) {
        throw new ConflictException(
          'Solo se emite comprobante de un pago aprobado',
        );
      }
      const existente = await manager
        .getRepository(Comprobante)
        .findOne({ where: { pago: { id: pagoId } } });
      if (existente && regenerar) {
        const r = await this.comprobantes.regenerar(existente, pago, manager);
        anterior = r.pdfPathAnterior;
        return {
          id: r.comprobante.id,
          generadoEn: r.comprobante.generadoEn,
          creado: false,
        };
      }
      if (existente) {
        return { id: existente.id, generadoEn: existente.generadoEn, creado: false };
      }
      const c = await this.comprobantes.generar(pago, manager);
      return { id: c.id, generadoEn: c.generadoEn, creado: true };
    });
    if (anterior) await this.comprobantes.eliminarArchivo(anterior);
    return resultado;
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

    // Flujo cancha (reserva existente). Todo dentro de UNA transacción y con la
    // fila de la reserva bloqueada: un doble clic, o dos recepcionistas a la vez,
    // se serializan y el segundo ve el pago ya aprobado (409).
    if (referencia.reservaCancha) {
      const reservaId = referencia.reservaCancha.id;
      return this.dataSource.transaction(async (manager) => {
        const reserva = await manager
          .getRepository(ReservaCancha)
          .createQueryBuilder('r')
          .innerJoinAndSelect('r.usuario', 'u')
          .innerJoinAndSelect('r.cancha', 'c')
          .innerJoinAndSelect('c.sede', 's')
          .setLock('pessimistic_write', undefined, ['r'])
          .where('r.id = :id', { id: reservaId })
          .getOne();
        // La reserva debe ser del cliente indicado: si no, para el cliente
        // es como si no existiera.
        if (!reserva || reserva.usuario.id !== dto.usuarioId) {
          throw new NotFoundException(
            'Reserva de cancha no encontrada para ese cliente',
          );
        }
        if (reserva.estado !== EstadoResCancha.CONFIRMADA) {
          throw new ConflictException('La reserva no está confirmada');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        if (
          registradoPor.tipoActor === TipoActor.RECEPCIONISTA ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
          registradoPor.tipoActor === TipoActor.GERENTE_SEDE
        ) {
          assertSedeScope(
            {
              id: registradoPor.id,
              tipoActor: registradoPor.tipoActor,
              email: registradoPor.email ?? '',
              sedeId: registradoPor.sede?.id ?? null,
            },
            reserva.cancha.sede.id,
          );
        }
        const pagosRepoTx = manager.getRepository(Pago);
        const yaPagada = await pagosRepoTx.exists({
          where: {
            reservaCancha: { id: reservaId },
            estado: EstadoPago.APROBADO,
          },
        });
        if (yaPagada) {
          throw new ConflictException(
            'La reserva ya tiene un pago aprobado: no se puede cobrar de nuevo',
          );
        }
        const pago = pagosRepoTx.create({
          usuario,
          registradoPor,
          reservaCancha: reserva,
          metodo: MetodoPago.EFECTIVO,
          // El monto sale de la reserva, nunca del cliente.
          monto: reserva.precioFinal,
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
    await this.membresiasService.asegurarSinProxima(dto.usuarioId);
    const vigente = await this.membresiasService.obtenerMembresiaVigente(
      dto.usuarioId,
    );
    const previa =
      vigente ??
      (await this.membresiasService.obtenerUltimaMembresia(dto.usuarioId));

    // Sede de alta de la membresía resultante: la del que cobra; si es
    // GG (sin sede), la de la membresía anterior. Sin ninguna fuente,
    // no se puede inventar una sede: se rechaza explícito.
    const sedeAltaId = vigente
      ? vigente.sedeAlta.id
      : (registradoPor.sede?.id ?? previa?.sedeAlta.id ?? null);
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
        const r = await this.cobrarMembresiaEnTransaccion(manager, {
          usuario,
          plan,
          sedeAltaId,
          monto,
          metodo: MetodoPago.EFECTIVO,
          registradoPor,
        });
        await this.generarYAdjuntar(r.guardado, manager);
        return r;
      },
    );
    if (promovidoId) {
      await this.auditarPromocion(promovidoId, guardado.id, registradoPor.id);
    }
    return guardado;
  }

  // Cobro presencial de cancha (mostrador): el cliente llega, elige cancha y
  // horario y paga en el acto. Reserva + pago EFECTIVO aprobado + comprobante
  // se guardan en UNA transacción; si cualquier paso falla no queda nada.
  // El precio sale del servidor (misma lógica que la reserva online).
  async cobrarCanchaPresencial(
    dto: CobrarCanchaPresencialDto,
    currentUser: UsuarioAutenticado,
  ): Promise<Pago> {
    const { cancha, usuario, precioFinal, estrategia } =
      await this.reservasCancha.prepararReservaPresencial(dto, currentUser);
    const registradoPor = await this.usuariosRepo.findOne({
      where: { id: currentUser.id },
    });
    if (!registradoPor)
      throw new NotFoundException(`Usuario ${currentUser.id} no encontrado`);

    return this.dataSource.transaction(async (manager) => {
      // Lock de la cancha, mantenimiento/bloqueos y sobreventa: los mismos
      // de la reserva online, dentro de esta transacción.
      const reserva = await this.reservasCancha.crearReservaEnTransaccion(
        manager,
        {
          canchaId: cancha.id,
          usuario,
          fecha: dto.fecha,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          precioFinal,
          estrategiaPrecio: estrategia,
        },
      );
      const pagosRepoTx = manager.getRepository(Pago);
      const guardado = await pagosRepoTx.save(
        pagosRepoTx.create({
          usuario,
          registradoPor,
          reservaCancha: reserva,
          metodo: MetodoPago.EFECTIVO,
          monto: String(precioFinal),
          estado: EstadoPago.APROBADO,
          pagadoEn: new Date(),
        }),
      );
      await this.generarYAdjuntar(guardado, manager);
      return guardado;
    });
  }

  // Cada uno ve sus pagos; el GG ve todos; el resto del personal ve solo los
  // pagos ligados a su sede (membresía dada de alta, cancha o clase de su sede).
  async findPorUsuario(
    usuarioId: string,
    query: PaginationQueryDto,
    currentUser: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Pago>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const propio: FindOptionsWhere<Pago> = { usuario: { id: usuarioId } };
    let where: FindOptionsWhere<Pago> | FindOptionsWhere<Pago>[] = propio;
    if (
      currentUser.id !== usuarioId &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      const sedeId = this.sedeDeCobro(currentUser);
      where = [
        { ...propio, membresia: { sedeAlta: { id: sedeId } } },
        { ...propio, reservaCancha: { cancha: { sede: { id: sedeId } } } },
        {
          ...propio,
          reservaClase: { ocurrencia: { clase: { sede: { id: sedeId } } } },
        },
      ];
    }
    const [data, total] = await this.pagosRepo.findAndCount({
      where,
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
      relations: {
        comprobante: true,
        usuario: true,
        registradoPor: true,
        membresia: { sedeAlta: true },
        reservaCancha: { cancha: { sede: true } },
        reservaClase: { ocurrencia: { clase: { sede: true } } },
      },
    });
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
    assertOwnerOrStaff(currentUser, pago.usuario.id);
    // El personal de sede solo ve pagos de su sede (fail-closed si no se
    // puede determinar de qué sede es el pago).
    if (
      currentUser.id !== pago.usuario.id &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      const sedeId =
        pago.membresia?.sedeAlta?.id ??
        pago.reservaCancha?.cancha?.sede?.id ??
        pago.reservaClase?.ocurrencia?.clase?.sede?.id;
      if (!sedeId) throw new ForbiddenException('No tenés permisos sobre este pago');
      assertSedeScope(currentUser, sedeId);
    }
    return pago;
  }
}
