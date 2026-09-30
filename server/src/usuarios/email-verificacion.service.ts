import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// Remitente de prueba de Resend (solo para desarrollo). En producción
// reemplazar por una dirección de un dominio propio verificado.
const REMITENTE_PRUEBA = 'FitZone Sports <onboarding@resend.dev>';

@Injectable()
export class EmailVerificacionService {
  private readonly logger = new Logger(EmailVerificacionService.name);

  constructor(private readonly config: ConfigService) {}

  async enviarVerificacion(
    email: string,
    nombre: string,
    token: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>('KEY_RESEND');
    if (!apiKey) {
      throw new Error(
        'KEY_RESEND no configurada: no se puede enviar el email de verificación',
      );
    }
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const link = `${frontendUrl}/verificar-email?token=${token}`;
    // En desarrollo se loguea SIEMPRE (antes de llamar a Resend), para
    // poder probar el flujo aunque el email no llegue (Resend en modo
    // prueba solo entrega a la casilla del dueño de la cuenta).
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`\n[DEV] Link de verificación para ${email}:\n${link}\n`);
    }
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: REMITENTE_PRUEBA,
      to: email,
      subject: 'Confirmá tu email en FitZone Sports',
      html: `<p>Hola ${nombre},</p><p>Confirmá tu email haciendo clic en este link (válido por 24 horas):</p><p><a href="${link}">Verificar mi email</a></p>`,
    });
    if (error) {
      this.logger.warn(`Resend rechazó el envío a ${email}: ${error.message}`);
      throw new Error(`Resend rechazó el envío: ${error.message}`);
    }
  }
}
