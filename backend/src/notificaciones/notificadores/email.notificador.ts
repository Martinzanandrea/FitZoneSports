import { Inject, Injectable, Logger } from '@nestjs/common';
import { describirErrorMail } from '../../common/helpers/error-mail.helper';
import {
  ENVIADOR_CORREO,
  type EnviadorCorreo,
} from '../../common/mail/enviador-correo';
import { renderEmailFitZone } from '../plantillas/email-fitzone';
import {
  CanalNotificacion,
  type Destinatario,
  type MensajeNotificacion,
  type Notificador,
} from '../notificaciones.types';

// Pausa entre mails consecutivos de un mismo lote (no saturar al proveedor).
export const PAUSA_ENTRE_EMAILS_MS = 300;

// Canal EMAIL: un mail por destinatario, solo a emails verificados, a través del
// proveedor de correo configurado (MAIL_PROVIDER).
@Injectable()
export class EmailNotificador implements Notificador {
  readonly canal = CanalNotificacion.EMAIL;
  readonly pausaMs = PAUSA_ENTRE_EMAILS_MS;
  private readonly logger = new Logger(EmailNotificador.name);

  constructor(@Inject(ENVIADOR_CORREO) private readonly mail: EnviadorCorreo) {}

  // Solo a emails verificados.
  puedeNotificar(destinatario: Destinatario): boolean {
    return !!destinatario.email && destinatario.emailVerificado;
  }

  async enviar(
    destinatario: Destinatario,
    mensaje: MensajeNotificacion,
  ): Promise<boolean> {
    if (!this.puedeNotificar(destinatario) || !destinatario.email) return false;
    const inicio = Date.now();
    try {
      await this.mail.enviar({
        para: destinatario.email,
        asunto: mensaje.titulo,
        html: renderEmailFitZone({
          nombre: destinatario.nombre,
          titulo: mensaje.titulo,
          mensaje: mensaje.mensaje,
        }),
      });
      return true;
    } catch (err) {
      // Ni dirección ni mensaje del error (puede incluir el destinatario):
      // solo el id del usuario y los códigos técnicos.
      this.logger.warn(
        `Falló el envío de un mail de notificación al usuario ${destinatario.id} (${describirErrorMail(err, Date.now() - inicio)})`,
      );
      return false;
    }
  }
}
