import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservaClase, ClaseOcurrencia, Membresia, Usuario } from '../entities';
import {
  EstadoMembresia,
  EstadoOcurrenciaClase,
  EstadoResClase,
  TipoActor,
} from '../entities/enums';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import {
  CLASE_CUPO_LIBERADO,
  type CupoLiberadoPayload,
} from './events/clase.events';
import {
  BOOKING_CLASE_REPOSITORY,
  type IBookingClaseRepository,
} from './booking-clase.repository';

const HORAS_LIMITE_RESERVA_PROPIA = 48;
const MINUTOS_LIMITE_RESERVA_STAFF = 30;
const HORAS_LIMITE_CANCELACION = 2;

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

  async reservar(
    ocurrenciaId: string,
    usuarioId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaClase> {
    const ocurrencia = await this.ocurrenciasRepo.findOne({
      where: { id: ocurrenciaId },
      relations: { clase: { sede: true } },
    });
    if (!ocurrencia || ocurrencia.estado !== EstadoOcurrenciaClase.PROGRAMADA) {
      throw new NotFoundException(
        `Ocurrencia ${ocurrenciaId} no disponible para reservar`,
      );
    }

    assertOwnerOrStaff(currentUser, usuarioId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.RECEPCIONISTA) {
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
    const membresiaActiva = await this.membresiasRepo.findOne({
      where: {
        usuario: { id: usuarioId },
        estado: EstadoMembresia.ACTIVO,
      },
    });
    if (!membresiaActiva) {
      throw new BadRequestException(
        'Necesitás una membresía activa para reservar clases',
      );
    }

    const yaReservada = await this.reservasRepo.findOne({
      where: { ocurrencia: { id: ocurrenciaId }, usuario: { id: usuarioId } },
    });
    if (yaReservada) {
      throw new ConflictException(
        'Este usuario ya tiene una reserva para esta ocurrencia',
      );
    }

    const inicioOcurrencia = new Date(
      `${ocurrencia.fecha}T${ocurrencia.horaInicio}`,
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
      relations: { ocurrencia: { clase: true }, usuario: true },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);
    //Patron de diseño Strategy aplicado para validar la cancelación de reservas según el tipo de usuario
    // y el tiempo restante para la clase.
    if (reserva.estado === EstadoResClase.RESERVADA) {
      const inicioOcurrencia = new Date(
        `${reserva.ocurrencia.fecha}T${reserva.ocurrencia.horaInicio}`,
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

  async findPorOcurrencia(
    ocurrenciaId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReservaClase>> {
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
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
