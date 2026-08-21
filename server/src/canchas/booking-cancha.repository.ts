import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cancha, ReservaCancha, BloqueoCancha, Usuario } from '../entities';
import {
  EstadoCancha,
  EstadoResCancha,
  TipoEstrategiaPrecio,
} from '../entities/enums';

interface DatosNuevaReserva {
  canchaId: string;
  usuario: Usuario;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precioFinal: number;
  estrategiaPrecio: TipoEstrategiaPrecio;
}

// Repository pattern (GoF): aísla la lógica de acceso a datos Y de
// concurrencia, separada del ReservasCanchaService que orquesta el flujo.
@Injectable()
export class BookingCanchaRepository {
  constructor(private readonly dataSource: DataSource) {}

  async crearReservaSegura(datos: DatosNuevaReserva): Promise<ReservaCancha> {
    //transacction abre un bloque de código que se ejecuta de manera atómica, si algo falla se hace rollback
    return this.dataSource.transaction(async (manager) => {
      // 1) Lock pesimista sobre la FILA DE LA CANCHA (no del horario puntual).
      // Esto serializa cualquier otra transacción que intente reservar
      // ESTA cancha (en cualquier horario) mientras esta transacción esté
      // abierta. Es lo que cierra la carrera "leer disponibilidad -> insertar":
      // sin este lock, dos requests simultáneas podrían leer "libre" ambas
      // y las dos intentarían insertar.
      const cancha = await manager //manager sirve para hacer queries dentro de la transacción,todo sucede dentro de la transacción, si algo falla se hace rollback
        .createQueryBuilder(Cancha, 'cancha')
        .setLock('pessimistic_write') // esto es el "FOR UPDATE"
        .where('cancha.id = :id', { id: datos.canchaId })
        .getOne();

      if (!cancha) {
        throw new NotFoundException(`Cancha ${datos.canchaId} no encontrada`);
      }
      if (cancha.estado === EstadoCancha.MANTENIMIENTO) {
        throw new BadRequestException('La cancha está en mantenimiento');
      }

      // 2) ¿Hay un bloqueo de mantenimiento que se solape con el horario pedido?
      const bloqueo = await manager
        .createQueryBuilder(BloqueoCancha, 'b')
        .where('b.cancha_id = :canchaId', { canchaId: datos.canchaId })
        .andWhere('b.desde <= :hasta AND b.hasta >= :desde', {
          desde: `${datos.fecha}T${datos.horaInicio}:00`,
          hasta: `${datos.fecha}T${datos.horaFin}:00`,
        })
        .getOne();
      if (bloqueo) {
        throw new BadRequestException(
          'La cancha tiene un bloqueo por mantenimiento en ese horario',
        );
      }

      // 3) RN02: chequeo explícito. Como ya tenemos el lock del paso 1,
      // ninguna otra transacción puede estar insertando para esta cancha
      // en este momento — así que esta lectura es confiable.
      const existente = await manager
        .createQueryBuilder(ReservaCancha, 'r')
        .where('r.cancha_id = :canchaId', { canchaId: datos.canchaId })
        .andWhere('r.fecha = :fecha', { fecha: datos.fecha })
        .andWhere('r.hora_inicio = :horaInicio', {
          horaInicio: datos.horaInicio,
        })
        .andWhere('r.estado = :estado', { estado: EstadoResCancha.CONFIRMADA })
        .getOne();

      if (existente) {
        throw new ConflictException(
          'Ese horario ya fue reservado para esta cancha',
        );
      }

      // 4) Insert final. Si por algún motivo el chequeo de arriba no
      // alcanzara (bug futuro, caso no previsto), el índice único parcial
      // de Postgres (uq_cancha_horario_confirmado) rechaza el INSERT de
      // todas formas — es la red de seguridad de última instancia.
      const reserva = manager.create(ReservaCancha, {
        cancha,
        usuario: datos.usuario,
        fecha: datos.fecha,
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
        precioFinal: String(datos.precioFinal),
        estrategiaPrecio: datos.estrategiaPrecio,
        estado: EstadoResCancha.CONFIRMADA,
      });

      return manager.save(reserva);
    });
  }
}
