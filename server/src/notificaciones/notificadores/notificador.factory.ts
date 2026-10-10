import { BadRequestException, Injectable } from '@nestjs/common';
import { CanalNotificacion, type Notificador } from '../notificaciones.types';
import { EmailNotificador } from './email.notificador';
import { PanelNotificador } from './panel.notificador';

// Patrón Factory: devuelve el notificador que corresponde al canal. Sumar un
// canal nuevo (p. ej. push) es agregar una clase y un `case`.
@Injectable()
export class NotificadorFactory {
  constructor(
    private readonly panel: PanelNotificador,
    private readonly email: EmailNotificador,
  ) {}

  crear(canal: CanalNotificacion): Notificador {
    switch (canal) {
      case CanalNotificacion.PANEL:
        return this.panel;
      case CanalNotificacion.EMAIL:
        return this.email;
      default:
        throw new BadRequestException(
          `Canal de notificación desconocido: ${String(canal)}`,
        );
    }
  }
}
