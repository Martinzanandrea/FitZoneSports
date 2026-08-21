import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservaClase, Clase, Usuario } from '../entities';
import { EstadoResClase } from '../entities/enums';
import { assertOwnerOrStaff } from 'src/auth/helpers/ownership.helper';

const HORAS_LIMITE_RESERVA = 48; // RF07: reserva hasta 48h antes
const HORAS_LIMITE_CANCELACION = 2; // RF07: cancelación libre hasta 2h antes

@Injectable()
export class ReservasClaseService {
  constructor(
    @InjectRepository(ReservaClase)
    private readonly reservasRepo: Repository<ReservaClase>,
    @InjectRepository(Clase)
    private readonly clasesRepo: Repository<Clase>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    // Este es el "Subject" del patrón Observer: emite eventos sin saber
    // quién los escucha (ListaEsperaListener, en nuestro caso).
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async reservar(claseId: string, usuarioId: string): Promise<ReservaClase> {
    const clase = await this.clasesRepo.findOne({ where: { id: claseId } });
    if (!clase) throw new NotFoundException(`Clase ${claseId} no encontrada`);

    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

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

    // Si ya no hay lugar, entra a lista de espera en vez de RESERVADA.
    const estado =
      cupoOcupado < clase.capacidad
        ? EstadoResClase.RESERVADA
        : EstadoResClase.LISTA_ESPERA;

    const reserva = this.reservasRepo.create({ clase, usuario, estado });
    return this.reservasRepo.save(reserva);
  }

  async cancelar(
    reservaId: string,
    currentUser: { id: string; tipoActor: string },
  ): Promise<ReservaClase> {
    const reserva = await this.reservasRepo.findOne({
      where: { id: reservaId },
      relations: { clase: true, usuario: true },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);

    // Solo se valida el límite de 2hs si tenía un cupo real tomado.
    // Cancelar desde lista de espera es libre, no le saca el lugar a nadie.
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

    // Acá está el "disparo" del Observer: si se liberó un cupo real,
    // emitimos el evento y el ListaEsperaListener reacciona por su cuenta.
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
      relations: { usuario: true },
      order: { creadaEn: 'ASC' },
    });
  }
}
