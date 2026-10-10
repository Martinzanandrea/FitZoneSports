import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { escaparHtml } from '../common/helpers/escape-html.helper';

const REMITENTE = 'FitZone Sports <fitzonesports@gmail.com>';

@Injectable()
export class EmailVerificacionService {
  private readonly logger = new Logger(EmailVerificacionService.name);

  constructor(private readonly config: ConfigService) {}

  async enviarVerificacion(
    email: string,
    nombre: string,
    token: string,
  ): Promise<void> {
    const user = this.config.get<string>('GMAIL_USER');
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD');
    if (!user || !pass) {
      throw new Error(
        'GMAIL_APP_PASSWORD no configurada: no se puede enviar el email de verificación',
      );
    }
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const link = `${frontendUrl}/verificar-email?token=${encodeURIComponent(token)}`;
    // Solo para probar el flujo sin mail real: el link lleva un token, así que
    // NO se imprime salvo que se active a propósito (MAIL_DEV_LOG_LINKS=true) y
    // nunca en producción. Tampoco lleva el email: solo el link.
    if (
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('MAIL_DEV_LOG_LINKS') === 'true'
    ) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Link de verificación: ${link}`);
    }
    const transporter = this.crearTransporte(user, pass);
    try {
      await transporter.sendMail({
        from: REMITENTE,
        to: email,
        subject: 'Confirmá tu email en FitZone Sports',
        // El nombre lo escribe el usuario al registrarse: se escapa.
        html: `<p>Hola ${escaparHtml(nombre)},</p><p>Confirmá tu email haciendo clic en este link (válido por 24 horas):</p><p><a href="${escaparHtml(link)}">Verificar mi email</a></p>`,
      });
    } catch (err) {
      // Ni la dirección ni el mensaje del SMTP (suele repetirla): solo el
      // código de error. Quien llama registra el id del usuario.
      const codigo =
        (err as { code?: string; responseCode?: number })?.code ??
        (err as { responseCode?: number })?.responseCode ??
        'desconocido';
      this.logger.warn(`El SMTP rechazó el envío de verificación (${codigo})`);
      throw new Error(`El SMTP rechazó el envío (${codigo})`);
    }
  }

  // Envío genérico (notificaciones): mismo transporte y remitente que la
  // verificación. Lanza si falla; quien llama decide qué hacer. No registra
  // la dirección ni el mensaje de error del SMTP (puede incluirla).
  async enviarCorreo(
    para: string,
    asunto: string,
    html: string,
  ): Promise<void> {
    const user = this.config.get<string>('GMAIL_USER');
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD');
    if (!user || !pass) {
      throw new Error('Servicio de mail no configurado');
    }
    // Sin saltos de línea en el asunto (evita inyección de cabeceras).
    const subject = asunto.replace(/[\r\n]+/g, ' ').trim();
    await this.crearTransporte(user, pass).sendMail({
      from: REMITENTE,
      to: para,
      subject,
      html,
    });
  }

  private crearTransporte(user: string, pass: string) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
}
