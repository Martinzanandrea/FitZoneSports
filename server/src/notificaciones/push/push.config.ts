import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Configuración VAPID leída de variables de entorno. Si falta alguna (o el
// subject no es mailto:/https:) el canal PUSH queda deshabilitado; la
// aplicación arranca igual. Nunca se registra el valor de las claves.
@Injectable()
export class PushConfig {
  readonly clavePublica: string | null;
  readonly clavePrivada: string | null;
  readonly subject: string | null;

  constructor(config: ConfigService) {
    const publica = config.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privada = config.get<string>('VAPID_PRIVATE_KEY')?.trim();
    const subject = config.get<string>('VAPID_SUBJECT')?.trim();
    const completa =
      !!publica &&
      !!privada &&
      !!subject &&
      /^(mailto:|https:\/\/)/.test(subject);
    this.clavePublica = completa ? publica : null;
    this.clavePrivada = completa ? privada : null;
    this.subject = completa ? subject : null;
    if (!completa) {
      new Logger(PushConfig.name).log(
        'Notificaciones push deshabilitadas: faltan o son inválidas VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT',
      );
    }
  }

  get habilitado(): boolean {
    return this.clavePublica !== null;
  }
}
