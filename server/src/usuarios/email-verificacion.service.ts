import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ENVIADOR_CORREO,
  type EnviadorCorreo,
} from '../common/mail/enviador-correo';
import { describirErrorMail } from '../common/helpers/error-mail.helper';
import { escaparHtml } from '../common/helpers/escape-html.helper';

@Injectable()
export class EmailVerificacionService {
  private readonly logger = new Logger(EmailVerificacionService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(ENVIADOR_CORREO) private readonly enviador: EnviadorCorreo,
  ) {}

  async enviarVerificacion(
    email: string,
    nombre: string,
    token: string,
  ): Promise<void> {
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
    const inicio = Date.now();
    try {
      await this.enviador.enviar({
        para: email,
        asunto: 'Confirmá tu email en FitZone Sports',
        // El nombre lo escribe el usuario al registrarse: se escapa.
        html: `<p>Hola ${escaparHtml(nombre)},</p><p>Confirmá tu email haciendo clic en este link (válido por 24 horas):</p><p><a href="${escaparHtml(link)}">Verificar mi email</a></p>`,
      });
    } catch (err) {
      // Ni la dirección ni el mensaje del proveedor (suele repetirla): solo el
      // código de error. Quien llama registra el id del usuario.
      const e = err as {
        code?: string;
        responseCode?: number;
        status?: number;
      };
      const codigo = e?.code ?? e?.responseCode ?? e?.status ?? 'desconocido';
      this.logger.warn(
        `El proveedor de correo rechazó el envío de verificación (${describirErrorMail(err, Date.now() - inicio)})`,
      );
      throw new Error(`El proveedor de correo rechazó el envío (${codigo})`);
    }
  }
}
