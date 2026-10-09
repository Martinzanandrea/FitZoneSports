import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Cancha, Usuario, ReservaCancha } from '../entities';
import { TipoActor, EstadoResCancha } from '../entities/enums';
import { estadoDesde } from '../membresias/estado-membresia';
import { MembresiasService } from '../membresias/membresias.service';
import {
  BOOKING_CANCHA_REPOSITORY,
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

    const inicio = new Date(`${dto.fecha}T${dto.horaInicio}:00`);
    if (inicio.getTime() <= Date.now()) {
      throw new BadRequestException('No se puede reservar un horario que ya comenzó');
    }

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

    const inicio = new Date(`${dto.fecha}T${dto.horaInicio}:00`);
    if (inicio.getTime() <= Date.now()) {
      throw new BadRequestException('No se puede reservar un horario que ya comenzó');
    }

    return this.calcularPrecio(cancha, usuario, dto.horaInicio);
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
    const reservas = await this.reservasRepo.find({
      where: {
        cancha: { id: canchaId },
        fecha,
        estado: EstadoResCancha.CONFIRMADA,
      },
      order: { horaInicio: 'ASC' },
    });
    return reservas.map((r) => ({
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
    }));
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
      relations: { usuario: true },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);

    reserva.estado = EstadoResCancha.CANCELADA;
    reserva.canceladaEn = new Date();
    return this.reservasRepo.save(reserva);
  }
}
