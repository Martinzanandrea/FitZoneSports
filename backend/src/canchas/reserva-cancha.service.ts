import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThanOrEqual, Repository } from 'typeorm';
import { BloqueoCancha, Cancha, Usuario, ReservaCancha } from '../entities';
import { TipoActor, EstadoCancha, EstadoResCancha } from '../entities/enums';
import { instanteArgentina } from '../common/helpers/hora-argentina.helper';
import {
  bloqueoSolapaTurno,
  esTurnoValido,
  turnosDelDia,
} from './turnos-cancha';
import { estadoDesde } from '../membresias/estado-membresia';
import { MembresiasService } from '../membresias/membresias.service';
import {
  BOOKING_CANCHA_REPOSITORY,
  type DatosNuevaReserva,
  type IBookingCanchaRepository,
} from './booking-cancha.repository';
import { PricingCalculatorService } from './pricing/pricing-calculator.service';
import { CreateReservaCanchaDto } from './dto/create-reserva-cancha.dto';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import {
  usuarioReducido,
  type UsuarioReducido,
} from '../common/helpers/usuario-reducido.helper';

export type ReservaCanchaListada = Omit<ReservaCancha, 'usuario'> & {
  usuario: UsuarioReducido;
};

export interface MiReservaCancha {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precioFinal: string;
  estrategiaPrecio: ReservaCancha['estrategiaPrecio'];
  estado: ReservaCancha['estado'];
  creadaEn: Date;
  cancha: { id: string; nombre: string; sede: { id: string; nombre: string } };
}

@Injectable()
export class ReservasCanchaService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchasRepo: Repository<Cancha>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(ReservaCancha)
    private readonly reservasRepo: Repository<ReservaCancha>,
    @Inject(BOOKING_CANCHA_REPOSITORY)
    private readonly bookingRepo: IBookingCanchaRepository,
    private readonly pricingCalculator: PricingCalculatorService,
    private readonly membresiasService: MembresiasService,
    @InjectRepository(BloqueoCancha)
    private readonly bloqueosRepo: Repository<BloqueoCancha>,
  ) {}

  /**
   * Facade: orquesta en un único punto de entrada la existencia de
   * cancha y usuario, sede-scope, ventana de horario no comenzado,
   * cálculo de precio (Strategy) y la creación transaccional con
   * lock (Repository).
   */
  async reservar(
    dto: CreateReservaCanchaDto,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaCancha> {
    const cancha = await this.canchasRepo.findOne({
      where: { id: dto.canchaId },
      relations: { sede: true },
    });
    if (!cancha)
      throw new NotFoundException(`Cancha ${dto.canchaId} no encontrada`);

    // Scope por exclusión (REGLAS GERENTE_SEDE): todo actor no-GG que
    // reserva para otro queda acotado a la sede de la cancha. El socio
    // o externo reservando para sí mismo no pasa por acá (RF03).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (
      currentUser.id !== dto.usuarioId &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      assertSedeScope(currentUser, cancha.sede.id);
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    this.assertTurnoValido(dto.horaInicio, dto.horaFin);
    this.assertTurnoNoComenzado(dto.fecha, dto.horaInicio);
    this.assertCanchaReservable(cancha);

    const { precioFinal, estrategia } = await this.calcularPrecio(
      cancha,
      usuario,
      dto.horaInicio,
    );

    return this.bookingRepo.crearReservaSegura({
      canchaId: dto.canchaId,
      usuario,
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      precioFinal,
      estrategiaPrecio: estrategia,
    });
  }

  async cotizar(dto: CreateReservaCanchaDto, currentUser: UsuarioAutenticado) {
    assertOwnerOrStaff(currentUser, dto.usuarioId);
    const cancha = await this.canchasRepo.findOne({
      where: { id: dto.canchaId },
      relations: { sede: true },
    });
    if (!cancha) throw new NotFoundException(`Cancha ${dto.canchaId} no encontrada`);

    // Mismo scope que reservar: el staff que cotiza para otro queda
    // acotado a la sede de la cancha.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (
      currentUser.id !== dto.usuarioId &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      assertSedeScope(currentUser, cancha.sede.id);
    }

    const usuario = await this.usuariosRepo.findOne({ where: { id: dto.usuarioId } });
    if (!usuario) throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    this.assertTurnoValido(dto.horaInicio, dto.horaFin);
    this.assertTurnoNoComenzado(dto.fecha, dto.horaInicio);
    this.assertCanchaReservable(cancha);

    return this.calcularPrecio(cancha, usuario, dto.horaInicio);
  }

  // Turnos en punto de una hora entre las 08:00 y las 22:00. Mismo criterio
  // que el cobro de mostrador: el precio es por hora, así que no se acepta
  // un horaFin elegido por el cliente.
  private assertTurnoValido(horaInicio: string, horaFin: string): void {
    if (!esTurnoValido(horaInicio, horaFin)) {
      throw new BadRequestException(
        'El turno debe ser de una hora, en punto, entre las 08:00 y las 22:00',
      );
    }
  }

  // Hora de Argentina, no la del servidor.
  private assertTurnoNoComenzado(fecha: string, horaInicio: string): void {
    if (instanteArgentina(fecha, horaInicio).getTime() <= Date.now()) {
      throw new BadRequestException('No se puede reservar un horario que ya comenzó');
    }
  }

  // Chequeo temprano para dar un error claro; el definitivo (y el de los
  // bloqueos por franja) lo hace el repositorio bajo el lock de la cancha.
  private assertCanchaReservable(cancha: Cancha): void {
    if (cancha.estado === EstadoCancha.MANTENIMIENTO) {
      throw new BadRequestException('La cancha está en mantenimiento');
    }
  }

  // Cobro presencial (paso 1, fuera de la transacción): valida cancha de la
  // sede de quien cobra, cliente Socio/Externo activo, turno válido y calcula
  // el precio en el servidor con la misma lógica que la reserva online
  // (descuento de socio, hora pico y cuota vencida = tarifa de externo).
  async prepararReservaPresencial(
    dto: {
      canchaId: string;
      usuarioId: string;
      fecha: string;
      horaInicio: string;
      horaFin: string;
    },
    currentUser: UsuarioAutenticado,
  ): Promise<{
    cancha: Cancha;
    usuario: Usuario;
    precioFinal: number;
    estrategia: DatosNuevaReserva['estrategiaPrecio'];
  }> {
    const cancha = await this.canchasRepo.findOne({
      where: { id: dto.canchaId },
      relations: { sede: true },
    });
    if (!cancha)
      throw new NotFoundException(`Cancha ${dto.canchaId} no encontrada`);
    // Fail-closed: otra sede, o sin sede asignada, es 403.
    assertSedeScope(currentUser, cancha.sede.id);

    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    const esCliente =
      usuario.tipoActor === TipoActor.SOCIO ||
      usuario.tipoActor === TipoActor.EXTERNO;
    if (!esCliente || !usuario.activo) {
      throw new BadRequestException(
        'El cliente debe ser un Socio o un Externo activo',
      );
    }

    if (!esTurnoValido(dto.horaInicio, dto.horaFin)) {
      throw new BadRequestException(
        'El turno debe ser de una hora, en punto, entre las 08:00 y las 22:00',
      );
    }
    this.assertTurnoNoComenzado(dto.fecha, dto.horaInicio);
    this.assertCanchaReservable(cancha);

    const { precioFinal, estrategia } = await this.calcularPrecio(
      cancha,
      usuario,
      dto.horaInicio,
    );
    return { cancha, usuario, precioFinal, estrategia };
  }

  // Paso 2: la inserción con el lock de la cancha, dentro de la transacción
  // de quien llama (comparte disponibilidad, mantenimiento y sobreventa con
  // la reserva online).
  crearReservaEnTransaccion(
    manager: EntityManager,
    datos: DatosNuevaReserva,
  ): Promise<ReservaCancha> {
    return this.bookingRepo.crearReservaSegura(datos, manager);
  }

  private async calcularPrecio(cancha: Cancha, usuario: Usuario, horaInicio: string) {
    let esSocioActivo = false;
    if (usuario.tipoActor === TipoActor.SOCIO) {
      const membresia = await this.membresiasService.obtenerMembresiaVigente(usuario.id);
      esSocioActivo = !!membresia && estadoDesde(membresia).tarifaAplicable() === 'SOCIO';
    }

    return this.pricingCalculator.calcular(Number(cancha.costoHoraBase), {
      esSocioActivo,
      esHoraPico: this.pricingCalculator.esHoraPico(horaInicio),
    });
  }

  // Listado de gestión: solo personal, acotado a la sede de la cancha
  // (fail-closed vía assertSedeScope). El usuario sale reducido.
  async findPorCancha(
    canchaId: string,
    fecha: string | undefined,
    query: PaginationQueryDto | undefined,
    currentUser: UsuarioAutenticado,
  ): Promise<PaginatedResponse<ReservaCanchaListada>> {
    const cancha = await this.canchasRepo.findOne({
      where: { id: canchaId },
      relations: { sede: true },
    });
    if (!cancha) throw new NotFoundException(`Cancha ${canchaId} no encontrada`);
    assertSedeScope(currentUser, cancha.sede.id);

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const [data, total] = await this.reservasRepo.findAndCount({
      where: fecha
        ? { cancha: { id: canchaId }, fecha }
        : { cancha: { id: canchaId } },
      relations: { usuario: true },
      order: { horaInicio: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((r) => ({ ...r, usuario: usuarioReducido(r.usuario) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Para Socio/Externo: solo franjas ocupadas de una cancha en una fecha,
  // sin ningún dato de quién reservó.
  async ocupacion(
    canchaId: string,
    fecha: string,
  ): Promise<Array<{ horaInicio: string; horaFin: string }>> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
    }
    const cancha = await this.canchasRepo.findOne({ where: { id: canchaId } });
    if (!cancha) throw new NotFoundException(`Cancha ${canchaId} no encontrada`);
    // Cancha en mantenimiento: ningún turno nuevo está disponible.
    if (cancha.estado === EstadoCancha.MANTENIMIENTO) {
      return turnosDelDia();
    }
    const reservas = await this.reservasRepo.find({
      where: {
        cancha: { id: canchaId },
        fecha,
        estado: EstadoResCancha.CONFIRMADA,
      },
      order: { horaInicio: 'ASC' },
    });
    const ocupadas = new Map<string, { horaInicio: string; horaFin: string }>(
      reservas.map((r) => [
        r.horaInicio.slice(0, 5),
        { horaInicio: r.horaInicio, horaFin: r.horaFin },
      ]),
    );
    // Bloqueos por rango: solo los turnos que toca cada bloqueo (sin motivo).
    const bloqueos = await this.bloqueosRepo.find({
      where: { cancha: { id: canchaId } },
    });
    for (const turno of turnosDelDia()) {
      if (
        bloqueos.some((b) =>
          bloqueoSolapaTurno(b, fecha, turno.horaInicio, turno.horaFin),
        )
      ) {
        ocupadas.set(turno.horaInicio.slice(0, 5), turno);
      }
    }
    return [...ocupadas.values()].sort((a, b) =>
      a.horaInicio.localeCompare(b.horaInicio),
    );
  }

  // Reservas CONFIRMADA del usuario autenticado (id del JWT, nunca de un
  // parámetro). fecha = día exacto; desde = a partir de ese día.
  async misReservas(
    usuarioId: string,
    filtros: { fecha?: string; desde?: string },
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<MiReservaCancha>> {
    for (const f of [filtros.fecha, filtros.desde]) {
      if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) {
        throw new BadRequestException('Las fechas deben tener formato YYYY-MM-DD');
      }
    }
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const [data, total] = await this.reservasRepo.findAndCount({
      where: {
        usuario: { id: usuarioId },
        estado: EstadoResCancha.CONFIRMADA,
        ...(filtros.fecha
          ? { fecha: filtros.fecha }
          : filtros.desde
            ? { fecha: MoreThanOrEqual(filtros.desde) }
            : {}),
      },
      relations: { cancha: { sede: true } },
      order: { fecha: 'ASC', horaInicio: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((r) => ({
        id: r.id,
        fecha: r.fecha,
        horaInicio: r.horaInicio,
        horaFin: r.horaFin,
        precioFinal: r.precioFinal,
        estrategiaPrecio: r.estrategiaPrecio,
        estado: r.estado,
        creadaEn: r.creadaEn,
        cancha: {
          id: r.cancha.id,
          nombre: r.cancha.nombre,
          sede: { id: r.cancha.sede.id, nombre: r.cancha.sede.nombre },
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async cancelar(
    reservaId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaCancha> {
    const reserva = await this.reservasRepo.findOne({
      where: { id: reservaId },
      relations: { usuario: true, cancha: { sede: true } },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);
    // El personal que cancela la reserva de otra persona queda acotado a la
    // sede de la cancha (GG: todas).
    if (
      currentUser.id !== reserva.usuario.id &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      assertSedeScope(currentUser, reserva.cancha.sede.id);
    }

    reserva.estado = EstadoResCancha.CANCELADA;
    reserva.canceladaEn = new Date();
    return this.reservasRepo.save(reserva);
  }
}
