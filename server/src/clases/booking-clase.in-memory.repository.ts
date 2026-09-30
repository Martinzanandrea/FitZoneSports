import { Injectable } from '@nestjs/common';
import { EstadoResClase } from '../entities/enums';
import type { ReservaClase } from '../entities';
import type {
  DatosNuevaReservaClase,
  IBookingClaseRepository,
} from './booking-clase.repository';

// Doble de test (Unidad V, con overrideProvider): mismo conteo y
// decisión RESERVADA/LISTA_ESPERA, sin base de datos. La capacidad por
// ocurrencia se configura con definirCapacidad (sin configurar, todo
// entra como RESERVADA).
@Injectable()
export class InMemoryBookingClaseRepository
  implements IBookingClaseRepository
{
  private reservas: any[] = [];
  private capacidades = new Map<string, number>();

  definirCapacidad(ocurrenciaId: string, capacidad: number): void {
    this.capacidades.set(ocurrenciaId, capacidad);
  }

  async reservarSegura(
    datos: DatosNuevaReservaClase,
  ): Promise<ReservaClase> {
    const capacidad =
      this.capacidades.get(datos.ocurrenciaId) ?? Number.MAX_SAFE_INTEGER;
    const ocupadas = this.reservas.filter(
      (r) =>
        r.ocurrenciaId === datos.ocurrenciaId &&
        r.estado === EstadoResClase.RESERVADA,
    ).length;
    const estado =
      ocupadas < capacidad
        ? EstadoResClase.RESERVADA
        : EstadoResClase.LISTA_ESPERA;
    const reserva = {
      id: crypto.randomUUID(),
      ocurrenciaId: datos.ocurrenciaId,
      usuarioId: datos.usuario.id,
      estado,
      creadaEn: new Date(),
    };
    this.reservas.push(reserva);
    return reserva as any;
  }
}
