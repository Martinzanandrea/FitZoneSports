import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BrevoEnviador } from './brevo.enviador';
import type { EnviadorCorreo } from './enviador-correo';
import { GmailSmtpEnviador } from './gmail-smtp.enviador';

// Elige el proveedor según MAIL_PROVIDER (brevo | gmail; default gmail). Se
// ejecuta al arrancar: una configuración inválida corta el arranque, y los
// mensajes nombran las variables pero nunca imprimen sus valores.
export function crearEnviadorCorreo(config: ConfigService): EnviadorCorreo {
  const proveedor =
    (config.get<string>('MAIL_PROVIDER') ?? '').trim().toLowerCase() || 'gmail';

  if (proveedor === 'gmail') {
    new Logger('Mail').log(
      'Proveedor de correo: gmail (SMTP, solo desarrollo)',
    );
    return new GmailSmtpEnviador(
      config.get<string>('GMAIL_USER'),
      config.get<string>('GMAIL_APP_PASSWORD'),
    );
  }

  if (proveedor === 'brevo') {
    const apiKey = config.get<string>('BREVO_API_KEY')?.trim();
    const remitenteEmail = config.get<string>('MAIL_FROM_EMAIL')?.trim();
    if (!apiKey || !remitenteEmail) {
      const faltantes = [
        !apiKey && 'BREVO_API_KEY',
        !remitenteEmail && 'MAIL_FROM_EMAIL',
      ].filter(Boolean);
      throw new Error(
        `MAIL_PROVIDER=brevo requiere definir ${faltantes.join(' y ')}`,
      );
    }
    new Logger('Mail').log('Proveedor de correo: brevo (API HTTPS)');
    return new BrevoEnviador({
      apiKey,
      remitenteEmail,
      remitenteNombre:
        config.get<string>('MAIL_FROM_NAME')?.trim() || 'FitZone Sports',
    });
  }

  throw new Error(
    'MAIL_PROVIDER inválido: los valores permitidos son brevo o gmail',
  );
}
