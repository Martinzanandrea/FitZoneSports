import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservaClase, Clase, Usuario } from '../entities';
import { EstadoResClase, TipoActor } from '../entities/enums';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

const HORAS_LIMITE_RESERVA = 48;
const HORAS_LIMITE_CANCELACION = 2;

@Injectable()
export class ReservasClaseService {
  constructor(
    @InjectRepository(ReservaClase)
    private readonly reservasRepo: Repository<ReservaClase>,
    @InjectRepository(Clase)
    private readonly clasesRepo: Repository<Clase>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async reservar(
    claseId: string,
    usuarioId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaClase> {
    const clase = await this.clasesRepo.findOne({
      where: { id: claseId },
      relations: { sede: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${claseId} no encontrada`);

    if (currentUser.tipoActor === TipoActor.RECEPCIONISTA) {
      assertSedeScope(currentUser, clase.sede.id);
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    const yaReservada = await this.reservasRepo.findOne({
      where: { clase: { id: claseId }, usuario: { id: usuarioId } },
    });
    if (yaReservada) {
      throw new ConflictException('Este usuario ya tiene una reserva para esta clase');
    }

    const horasHastaClase =
      (clase.horarioInicio.getTime() - Date.now()) / (1000 * 60 * 60);
    if (horasHastaClase < HORAS_LIMITE_RESERVA) {
      throw new BadRequestException(
        `Solo se puede reservar hasta ${HORAS_LIMITE_RESERVA}hs antes del inicio de la clase`,
      );
    }

    const cupoOcupado = await this.reservasRepo.count({
      where: { clase: { id: claseId }, estado: EstadoResClase.RESERVADA },
    });

    const estado =
      cupoOcupado < clase.capacidad
        ? EstadoResClase.RESERVADA
        : EstadoResClase.LISTA_ESPERA;

    const reserva = this.reservasRepo.create({ clase, usuario, estado });
    return this.reservasRepo.save(reserva);
  }

  async cancelar(
    reservaId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaClase> {
    const reserva = await this.reservasRepo.findOne({
      where: { id: reservaId },
      relations: { clase: true, usuario: true },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);

    if (reserva.estado === EstadoResClase.RESERVADA) {
      const horasHastaClase =
        (reserva.clase.horarioInicio.getTime() - Date.now()) / (1000 * 60 * 60);
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
      this.eventEmitter.emit('clase.cupo-liberado', {
        claseId: reserva.clase.id,
      });
    }

    return guardada;
  }

  findPorClase(claseId: string): Promise<ReservaClase[]> {
    return this.reservasRepo.find({
      where: { clase: { id: claseId } },
      relations: { usuario: true, clase: { sede: true, instructor: true } },
      order: { creadaEn: 'ASC' },
    });
  }
}
