import * as nodemailer from 'nodemailer';
import {
  limpiarAsunto,
  type EnviadorCorreo,
  type MensajeCorreo,
} from './enviador-correo';

const REMITENTE = 'FitZone Sports <fitzonesports@gmail.com>';

// Solo desarrollo local: Gmail por SMTP (puerto 465). En Render el SMTP saliente
// está bloqueado (ETIMEDOUT): allí se usa MAIL_PROVIDER=brevo.
export class GmailSmtpEnviador implements EnviadorCorreo {
  constructor(
    private readonly user: string | undefined,
    private readonly pass: string | undefined,
  ) {}

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    if (!this.user || !this.pass) {
      throw new Error(
        'Servicio de mail no configurado: faltan GMAIL_USER / GMAIL_APP_PASSWORD',
      );
    }
    const transporte = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: this.user, pass: this.pass },
    });
    await transporte.sendMail({
      from: REMITENTE,
      to: mensaje.para,
      subject: limpiarAsunto(mensaje.asunto),
      html: mensaje.html,
      ...(mensaje.texto ? { text: mensaje.texto } : {}),
    });
  }
}
