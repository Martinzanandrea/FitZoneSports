import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ClaseOcurrencia, ReservaClase } from '../../entities';
import { EstadoOcurrenciaClase, EstadoResClase } from '../../entities/enums';
import {
  CLASE_CUPO_LIBERADO,
  type CupoLiberadoPayload,
} from '../events/clase.events';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import {
  CANALES_POR_EVENTO,
  TipoNotificacion,
} from '../../notificaciones/notificaciones.types';

function fechaLarga(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

// Este es el "Observer" del patrón: no lo llama nadie directamente,
// reacciona solo cuando alguien emite el evento 'clase.cupo-liberado'.
@Injectable()
export class ListaEsperaListener {
  private readonly logger = new Logger(ListaEsperaListener.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificaciones: NotificacionesService,
  ) {}

  @OnEvent(CLASE_CUPO_LIBERADO)
  async promoverSiguienteEnEspera(payload: CupoLiberadoPayload) {
    const promovida = await this.promoverAtomicamente(payload.ocurrenciaId);
    if (!promovida) return; // nadie esperando o sin lugar: nada que hacer

    // La promoción ya está confirmada (commit hecho): un fallo al notificar
    // nunca la revierte ni la impide.
    try {
      const { ocurrencia } = promovida;
      await this.notificaciones.notificarUsuario(
        promovida.usuario,
        {
          tipo: TipoNotificacion.LISTA_ESPERA_PROMOVIDA,
          titulo: 'Se liberó un cupo y ya estás anotado',
          mensaje: `Pasaste de la lista de espera a la clase ${ocurrencia.clase.tipoClase} del ${fechaLarga(ocurrencia.fecha)} a las ${ocurrencia.horaInicio.slice(0, 5)}. Tu lugar está confirmado.`,
        },
        CANALES_POR_EVENTO[TipoNotificacion.LISTA_ESPERA_PROMOVIDA],
      );
    } catch {
      this.logger.warn('No se pudo notificar una promoción de lista de espera');
    }
  }

  // Transacción con lock de la ocurrencia (FOR UPDATE, la misma fila que
  // bloquea la reserva): se vuelve a contar el cupo y solo se promueve si hay
  // lugar. Así, una cancelación y una reserva nueva simultáneas no pueden
  // sobrevender la clase.
  private async promoverAtomicamente(
    ocurrenciaId: string,
  ): Promise<ReservaClase | null> {
    return this.dataSource.transaction(async (manager) => {
      const ocurrencia = await manager
        .createQueryBuilder(ClaseOcurrencia, 'oc')
        .setLock('pessimistic_write', undefined, ['oc'])
        .leftJoinAndSelect('oc.clase', 'clase')
        .where('oc.id = :id', { id: ocurrenciaId })
        .getOne();
      if (
        !ocurrencia ||
        ocurrencia.estado !== EstadoOcurrenciaClase.PROGRAMADA ||
        ocurrencia.clase.activa === false
      ) {
        return null;
      }

      const cupoOcupado = await manager.count(ReservaClase, {
        where: {
          ocurrencia: { id: ocurrenciaId },
          estado: EstadoResClase.RESERVADA,
        },
      });
      if (cupoOcupado >= ocurrencia.clase.capacidad) return null;

      const siguiente = await manager.findOne(ReservaClase, {
        where: {
          ocurrencia: { id: ocurrenciaId },
          estado: EstadoResClase.LISTA_ESPERA,
        },
        order: { creadaEn: 'ASC' }, // el que se anotó primero a la espera, entra primero
        relations: { usuario: true },
      });
      if (!siguiente) return null;

      siguiente.estado = EstadoResClase.RESERVADA;
      siguiente.notificado = true;
      await manager.save(siguiente);
      siguiente.ocurrencia = ocurrencia;
      return siguiente;
    });
  }
}
