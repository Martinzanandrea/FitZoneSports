import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservaClase, ClaseOcurrencia, Membresia, Usuario } from '../entities';
import {
  EstadoMembresia,
  EstadoOcurrenciaClase,
  EstadoResClase,
  TipoActor,
} from '../entities/enums';
import { estadoDesde } from '../membresias/estado-membresia';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { instanteArgentina } from '../common/helpers/hora-argentina.helper';
import {
  usuarioReducido,
  type UsuarioReducido,
} from '../common/helpers/usuario-reducido.helper';
import {
  CLASE_CUPO_LIBERADO,
  type CupoLiberadoPayload,
} from './events/clase.events';
import {
  HORAS_LIMITE_CANCELACION,
  HORAS_LIMITE_RESERVA_PROPIA,
  MINUTOS_LIMITE_RESERVA_STAFF,
} from './reglas-clases';
import {
  BOOKING_CLASE_REPOSITORY,
  type IBookingClaseRepository,
} from './booking-clase.repository';

export type ReservaClaseListada = Omit<ReservaClase, 'usuario'> & {
  usuario: UsuarioReducido;
};

export interface MiReservaClase {
  id: string;
  estado: EstadoResClase;
  creadaEn: Date;
  ocurrencia: {
    id: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    estado: EstadoOcurrenciaClase;
    clase: {
      id: string;
      tipoClase: string;
      sede: { id: string; nombre: string };
      instructor: { id: string; nombre: string };
    };
  };
}

@Injectable()
export class ReservasClaseService {
  constructor(
    @InjectRepository(ReservaClase)
    private readonly reservasRepo: Repository<ReservaClase>,
    @InjectRepository(ClaseOcurrencia)
    private readonly ocurrenciasRepo: Repository<ClaseOcurrencia>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    @Inject(BOOKING_CLASE_REPOSITORY)
    private readonly bookingRepo: IBookingClaseRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Facade: orquesta en un único punto de entrada la validación de
   * ocurrencia PROGRAMADA, ownership, sede-scope, rechazo explícito de
   * EXTERNO, membresía ACTIVA (State), duplicado y ventana de
   * anticipación, y delega el tramo final a la creación transaccional
   * con lock (Repository).
   */
  async reservar(
    ocurrenciaId: string,
    usuarioId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaClase> {
    const ocurrencia = await this.ocurrenciasRepo.findOne({
      where: { id: ocurrenciaId },
      relations: { clase: { sede: true } },
    });
    // Una clase dada de baja no se reserva (sus ocurrencias futuras ya están canceladas).
    if (
      !ocurrencia ||
      ocurrencia.estado !== EstadoOcurrenciaClase.PROGRAMADA ||
      !ocurrencia.clase.activa
    ) {
      throw new NotFoundException(
        `Ocurrencia ${ocurrenciaId} no disponible para reservar`,
      );
    }

    assertOwnerOrStaff(currentUser, usuarioId);

    // Scope por exclusión (REGLAS GERENTE_SEDE): todo actor no-GG que
    // reserva para otro queda acotado a la sede de la clase. El socio
    // reservando para sí mismo no pasa por acá (sedeId null = todas).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (
      currentUser.id !== usuarioId &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      assertSedeScope(currentUser, ocurrencia.clase.sede.id);
    }

    // Un Externo nunca puede tener membresía por diseño: rechazo explícito
    // antes del chequeo genérico de RN-03 (vale para el usuario destino).
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    if (usuario.tipoActor === TipoActor.EXTERNO) {
      throw new ForbiddenException(
        'Las clases grupales son exclusivas para socios. Los clientes externos pueden alquilar canchas.',
      );
    }

    // RN-03: solo socios con membresía activa reservan clases. Vale para
    // el usuario destino (usuarioId), también cuando el staff anota a otro.
    const membresia = await this.membresiasRepo.findOne({
      where: {
        usuario: { id: usuarioId },
        estado: EstadoMembresia.ACTIVO,
      },
    });
    if (!membresia || !estadoDesde(membresia).puedeReservarClases()) {
      throw new BadRequestException(
        'Necesitás una membresía activa para reservar clases',
      );
    }

    const yaReservada = await this.reservasRepo.findOne({
      where: { ocurrencia: { id: ocurrenciaId }, usuario: { id: usuarioId } },
    });
    // Una CANCELADA no bloquea: el repository la reactiva bajo lock.
    if (yaReservada && yaReservada.estado !== EstadoResClase.CANCELADA) {
      throw new ConflictException(
        'Este usuario ya tiene una reserva para esta ocurrencia',
      );
    }

    const inicioOcurrencia = instanteArgentina(
      ocurrencia.fecha,
      ocurrencia.horaInicio,
    );
    const minutosHastaClase =
      (inicioOcurrencia.getTime() - Date.now()) / (1000 * 60);
    const esReservaParaOtraPersona = currentUser.id !== usuarioId;
    const limiteMinutos = esReservaParaOtraPersona
      ? MINUTOS_LIMITE_RESERVA_STAFF
      : HORAS_LIMITE_RESERVA_PROPIA * 60;
    if (minutosHastaClase < limiteMinutos) {
      throw new BadRequestException(
        esReservaParaOtraPersona
          ? `Solo se puede anotar hasta ${MINUTOS_LIMITE_RESERVA_STAFF} minutos antes del inicio de la clase`
          : `Solo se puede reservar hasta ${HORAS_LIMITE_RESERVA_PROPIA}hs antes del inicio de la clase`,
      );
    }

    // Tramo final atómico: el conteo de cupo y la inserción corren
    // dentro de la transacción con lock del repository (cierra la
    // carrera del último cupo). Las validaciones de arriba no cambian.
    return this.bookingRepo.reservarSegura({ ocurrenciaId, usuario });
  }

  async cancelar(
    reservaId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaClase> {
    const reserva = await this.reservasRepo.findOne({
      where: { id: reservaId },
      relations: { ocurrencia: { clase: { sede: true } }, usuario: true },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);
    // El personal que cancela la reserva de otra persona queda acotado a la
    // sede de la clase (GG: todas).
    if (
      currentUser.id !== reserva.usuario.id &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL
    ) {
      assertSedeScope(currentUser, reserva.ocurrencia.clase.sede.id);
    }
    //Patron de diseño Strategy aplicado para validar la cancelación de reservas según el tipo de usuario
    // y el tiempo restante para la clase.
    if (reserva.estado === EstadoResClase.RESERVADA) {
      const inicioOcurrencia = instanteArgentina(
        reserva.ocurrencia.fecha,
        reserva.ocurrencia.horaInicio,
      );
      const horasHastaClase =
        (inicioOcurrencia.getTime() - Date.now()) / (1000 * 60 * 60);
      if (horasHastaClase < HORAS_LIMITE_CANCELACION) {
        throw new BadRequestException(
          `Solo se puede cancelar hasta ${HORAS_LIMITE_CANCELACION}hs antes del inicio de la clase`,
        );
      }
    }

    const liberoCupo = reserva.estado === EstadoResClase.RESERVADA;
    reserva.estado = EstadoResClase.CANCELADA;
    reserva.canceladaEn = new Date();
    const guardada = await this.reservasRepo.save(reserva);

    if (liberoCupo) {
      const payload: CupoLiberadoPayload = {
        ocurrenciaId: reserva.ocurrencia.id,
      };
      this.eventEmitter.emit(CLASE_CUPO_LIBERADO, payload);
    }

    return guardada;
  }

  // Listado de gestión: solo personal, acotado a la sede de la clase
  // (fail-closed vía assertSedeScope). El usuario sale reducido.
  async findPorOcurrencia(
    ocurrenciaId: string,
    query: PaginationQueryDto,
    currentUser: UsuarioAutenticado,
  ): Promise<PaginatedResponse<ReservaClaseListada>> {
    const ocurrencia = await this.ocurrenciasRepo.findOne({
      where: { id: ocurrenciaId },
      relations: { clase: { sede: true } },
    });
    if (!ocurrencia)
      throw new NotFoundException(`Ocurrencia ${ocurrenciaId} no encontrada`);
    assertSedeScope(currentUser, ocurrencia.clase.sede.id);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.reservasRepo.findAndCount({
      where: { ocurrencia: { id: ocurrenciaId } },
      relations: {
        usuario: true,
        ocurrencia: { clase: { sede: true } },
      },
      order: { creadaEn: 'ASC' },
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

  // Reservas activas (RESERVADA / LISTA_ESPERA) del usuario autenticado:
  // el id sale del JWT, nunca de un parámetro. Incluye instructor y sede
  // para que el cliente no dependa de otra consulta.
  async misReservas(
    usuarioId: string,
    desde: string | undefined,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<MiReservaClase>> {
    if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      throw new BadRequestException(
        'El filtro desde debe tener formato YYYY-MM-DD',
      );
    }
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const [data, total] = await this.reservasRepo.findAndCount({
      where: {
        usuario: { id: usuarioId },
        estado: In([EstadoResClase.RESERVADA, EstadoResClase.LISTA_ESPERA]),
        ...(desde ? { ocurrencia: { fecha: MoreThanOrEqual(desde) } } : {}),
      },
      relations: { ocurrencia: { clase: { sede: true, instructor: true } } },
      order: { ocurrencia: { fecha: 'ASC', horaInicio: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((r) => ({
        id: r.id,
        estado: r.estado,
        creadaEn: r.creadaEn,
        ocurrencia: {
          id: r.ocurrencia.id,
          fecha: r.ocurrencia.fecha,
          horaInicio: r.ocurrencia.horaInicio,
          horaFin: r.ocurrencia.horaFin,
          estado: r.ocurrencia.estado,
          clase: {
            id: r.ocurrencia.clase.id,
            tipoClase: r.ocurrencia.clase.tipoClase,
            sede: {
              id: r.ocurrencia.clase.sede.id,
              nombre: r.ocurrencia.clase.sede.nombre,
            },
            instructor: {
              id: r.ocurrencia.clase.instructor.id,
              nombre: r.ocurrencia.clase.instructor.nombre,
            },
          },
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
