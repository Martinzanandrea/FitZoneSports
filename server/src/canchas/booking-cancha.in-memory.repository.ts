import { ConflictException, Injectable } from '@nestjs/common';
import { EstadoResCancha } from '../entities/enums';
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

  async crearReservaSegura(
    datos: DatosNuevaReserva,
  ): Promise<ReservaCancha> {
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
