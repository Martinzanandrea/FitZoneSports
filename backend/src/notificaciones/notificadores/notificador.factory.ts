import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CanalNotificacion,
  NOTIFICADORES,
  type Notificador,
} from '../notificaciones.types';

// Patrón Factory: única vía para obtener el notificador de un canal. No conoce
// clases concretas: recibe todos los notificadores registrados (token
// NOTIFICADORES, armado en NotificacionesModule) y los indexa por el canal que
// cada uno declara. Sumar un canal no exige editar esta clase.
@Injectable()
export class NotificadorFactory {
  private readonly porCanal = new Map<CanalNotificacion, Notificador>();

  constructor(@Inject(NOTIFICADORES) notificadores: Notificador[]) {
    for (const notificador of notificadores) {
      if (this.porCanal.has(notificador.canal)) {
        // Falla al arrancar: dos clases no pueden atender el mismo canal.
        throw new Error(
          `Dos notificadores declaran el mismo canal: ${notificador.canal}`,
        );
      }
      this.porCanal.set(notificador.canal, notificador);
    }
  }

  crear(canal: CanalNotificacion): Notificador {
    const notificador = this.porCanal.get(canal);
    if (!notificador) {
      throw new BadRequestException(
        `Canal de notificación desconocido: ${String(canal)}`,
      );
    }
    return notificador;
  }

  canalesDisponibles(): CanalNotificacion[] {
    return [...this.porCanal.keys()];
  }
}
