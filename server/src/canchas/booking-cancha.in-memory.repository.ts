import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EstadoCancha, EstadoResCancha } from '../entities/enums';
import type { ReservaCancha } from '../entities';
import type {
  DatosNuevaReserva,
  IBookingCanchaRepository,
} from './booking-cancha.repository';

@Injectable()
export class InMemoryBookingCanchaRepository
  implements IBookingCanchaRepository
{
  private reservas: any[] = [];
  private estadosCancha = new Map<string, EstadoCancha>();

  // Replica el gate del repositorio real (MANTENIMIENTO → rechazar).
  // Mismo criterio que definirCapacidad() en el in-memory de clases:
  // por defecto toda cancha simulada está ACTIVA, el test marca las
  // que quiere en mantenimiento.
  definirEstadoCancha(canchaId: string, estado: EstadoCancha): void {
    this.estadosCancha.set(canchaId, estado);
  }

  async crearReservaSegura(
    datos: DatosNuevaReserva,
  ): Promise<ReservaCancha> {
    const estadoCancha =
      this.estadosCancha.get(datos.canchaId) ?? EstadoCancha.ACTIVA;
    if (estadoCancha === EstadoCancha.MANTENIMIENTO) {
      throw new BadRequestException('La cancha está en mantenimiento');
    }
    const yaExiste = this.reservas.some(
      (r) =>
        r.canchaId === datos.canchaId &&
        r.fecha === datos.fecha &&
        r.horaInicio === datos.horaInicio &&
        r.estado === EstadoResCancha.CONFIRMADA,
    );
    if (yaExiste) {
      throw new ConflictException(
        'Ese horario ya fue reservado para esta cancha',
      );
    }
    const reserva = {
      id: crypto.randomUUID(),
      ...datos,
      estado: EstadoResCancha.CONFIRMADA,
    };
    this.reservas.push(reserva);
    return reserva as any;
  }
}
