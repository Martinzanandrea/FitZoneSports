import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClaseOcurrencia, ReservaClase, Usuario } from '../entities';
import { EstadoResClase } from '../entities/enums';

export interface DatosNuevaReservaClase {
  ocurrenciaId: string;
  usuario: Usuario;
}

export interface IBookingClaseRepository {
  reservarSegura(datos: DatosNuevaReservaClase): Promise<ReservaClase>;
}

export const BOOKING_CLASE_REPOSITORY = 'BOOKING_CLASE_REPOSITORY';

// Mismo patrón que BookingCanchaRepository: la concurrencia del último
// cupo se cierra con transacción + lock pesimista, separada del service
// que orquesta las validaciones (ownership, sede, membresía, tiempos).
@Injectable()
export class TypeOrmBookingClaseRepository
  implements IBookingClaseRepository
{
  constructor(private readonly dataSource: DataSource) {}

  async reservarSegura(
    datos: DatosNuevaReservaClase,
  ): Promise<ReservaClase> {
    return this.dataSource.transaction(async (manager) => {
      // 1) Lock pesimista sobre la OCURRENCIA (no la clase entera:
      // dos reservas de ocurrencias distintas de la misma clase no
      // deben bloquearse entre sí). Serializa a quien lea/escriba
      // ESTA ocurrencia mientras la transacción siga abierta.
      const ocurrencia = await manager
        .createQueryBuilder(ClaseOcurrencia, 'oc')
        .setLock('pessimistic_write') // FOR UPDATE
        .leftJoinAndSelect('oc.clase', 'clase')
        .where('oc.id = :id', { id: datos.ocurrenciaId })
        .getOne();

      if (!ocurrencia) {
        throw new NotFoundException(
          `Ocurrencia ${datos.ocurrenciaId} no encontrada`,
        );
      }

      // 2) Ya con el lock tomado, esta lectura es confiable: nadie
      // más puede estar insertando para esta ocurrencia en este momento.
      const cupoOcupado = await manager.count(ReservaClase, {
        where: {
          ocurrencia: { id: datos.ocurrenciaId },
          estado: EstadoResClase.RESERVADA,
        },
      });

      const estado =
        cupoOcupado < ocurrencia.clase.capacidad
          ? EstadoResClase.RESERVADA
          : EstadoResClase.LISTA_ESPERA;

      const reserva = manager.create(ReservaClase, {
        ocurrencia,
        usuario: datos.usuario,
        estado,
      });

      return manager.save(reserva);
    });
  }
}
