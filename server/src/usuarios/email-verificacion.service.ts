import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
    const link = `${frontendUrl}/verificar-email?token=${token}`;
    // En desarrollo se loguea SIEMPRE (antes de enviar por SMTP), para
    // poder probar el flujo aunque el email no llegue.
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`\n[DEV] Link de verificación para ${email}:\n${link}\n`);
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    try {
      await transporter.sendMail({
        from: REMITENTE,
        to: email,
        subject: 'Confirmá tu email en FitZone Sports',
        html: `<p>Hola ${nombre},</p><p>Confirmá tu email haciendo clic en este link (válido por 24 horas):</p><p><a href="${link}">Verificar mi email</a></p>`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gmail SMTP rechazó el envío a ${email}: ${message}`);
      throw new Error(`Gmail SMTP rechazó el envío: ${message}`);
    }
  }
}
