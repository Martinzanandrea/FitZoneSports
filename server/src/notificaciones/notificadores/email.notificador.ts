import { Injectable, Logger } from '@nestjs/common';
import { EmailVerificacionService } from '../../usuarios/email-verificacion.service';
import { renderEmailFitZone } from '../plantillas/email-fitzone';
import type {
  Destinatario,
  MensajeNotificacion,
  Notificador,
} from '../notificaciones.types';

// Pausa entre mails consecutivos de un mismo lote (no saturar el SMTP).
export const PAUSA_ENTRE_EMAILS_MS = 300;

// Canal EMAIL: un mail por destinatario, solo a emails verificados, usando el
// servicio de mail existente (mismo transporte y remitente).
@Injectable()
export class EmailNotificador implements Notificador {
  private readonly logger = new Logger(EmailNotificador.name);

  constructor(private readonly mail: EmailVerificacionService) {}

  async enviar(
    destinatario: Destinatario,
    mensaje: MensajeNotificacion,
  ): Promise<boolean> {
    if (!destinatario.email || !destinatario.emailVerificado) return false;
    try {
      await this.mail.enviarCorreo(
        destinatario.email,
        mensaje.titulo,
        renderEmailFitZone({
          nombre: destinatario.nombre,
          titulo: mensaje.titulo,
          mensaje: mensaje.mensaje,
        }),
      );
      return true;
    } catch {
      // Ni dirección ni mensaje del error (puede incluir el destinatario).
      this.logger.warn('Falló el envío de un mail de notificación');
      return false;
    }
  }
}
