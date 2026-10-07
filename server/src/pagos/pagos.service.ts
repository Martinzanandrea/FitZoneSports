import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Pago, Usuario, Membresia, ReservaCancha } from '../entities';
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

  async obtenerOpcionesCobro(currentUser: UsuarioAutenticado) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esGG = currentUser.tipoActor === TipoActor.GERENTE_GENERAL;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (!esGG && !currentUser.sedeId) {
      throw new ForbiddenException('Tu usuario no tiene una sede asignada');
    }
    const sedeId = currentUser.sedeId;
    const [usuarios, membresias, reservasCancha] = await Promise.all([
      this.usuariosRepo.find({ relations: { sede: true } }),
      this.membresiasRepo.find({
        relations: { usuario: true, sedeAlta: true },
      }),
      this.reservasCanchaRepo.find({
        where: { estado: EstadoResCancha.CONFIRMADA },
        relations: { usuario: true, cancha: { sede: true } },
      }),
    ]);

    const esDeSede = (sede?: { id: string } | null) =>
      !sedeId || sede?.id === sedeId;
    const membresiasDeSede = membresias.filter((m) => esDeSede(m.sedeAlta));
    const reservasCanchaDeSede = reservasCancha.filter((r) =>
      esDeSede(r.cancha.sede),
    );
    const idsUsuarios = new Set([
      ...membresiasDeSede.map((m) => m.usuario.id),
      ...reservasCanchaDeSede.map((r) => r.usuario.id),
      ...usuarios.filter((u) => esDeSede(u.sede)).map((u) => u.id),
    ]);

    return {
      // Solo SOCIO y EXTERNO, con campos mínimos: sin emails,
      // teléfonos ni personal.
      usuarios: usuarios
        .filter(
          (u) =>
            idsUsuarios.has(u.id) &&
            (u.tipoActor === TipoActor.SOCIO ||
              u.tipoActor === TipoActor.EXTERNO),
        )
        .map((u) => ({
          id: u.id,
          nombre: u.nombre,
          apellido: u.apellido,
          dni: u.dni ?? null,
          tipoActor: u.tipoActor,
        })),
      membresias: membresiasDeSede.map((m) => ({
        id: m.id,
        plan: m.plan,
        estado: m.estado,
        fechaInicio: m.fechaInicio,
        fechaFin: m.fechaFin,
        usuario: {
          id: m.usuario.id,
          nombre: m.usuario.nombre,
          apellido: m.usuario.apellido,
          dni: m.usuario.dni ?? null,
        },
        sedeAlta: { id: m.sedeAlta.id, nombre: m.sedeAlta.nombre },
      })),
      reservasCancha: reservasCanchaDeSede.map((r) => ({
        id: r.id,
        estado: r.estado,
        fecha: r.fecha,
        horaInicio: r.horaInicio,
        horaFin: r.horaFin,
        precioFinal: r.precioFinal,
        usuario: {
          id: r.usuario.id,
          nombre: r.usuario.nombre,
          apellido: r.usuario.apellido,
          dni: r.usuario.dni ?? null,
        },
        cancha: {
          nombre: r.cancha.nombre,
          sede: { id: r.cancha.sede.id, nombre: r.cancha.sede.nombre },
        },
      })),
    };
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

    await this.comprobantes.generar(guardado);
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
        await this.comprobantes.generar(guardado, manager);
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
        await this.comprobantes.generar(guardado, manager);
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
