import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSuscripcion } from '../../entities';
import { PushConfig } from '../push/push.config';
import {
  CanalNotificacion,
  type Destinatario,
  type MensajeNotificacion,
  type Notificador,
} from '../notificaciones.types';

// Pausa entre usuarios consecutivos de un mismo lote.
export const PAUSA_ENTRE_PUSH_MS = 100;
// Vida máxima del mensaje en el servicio push si el dispositivo está apagado.
export const TTL_PUSH_SEGUNDOS = 3600;
const MAX_TITULO = 80;
const MAX_CUERPO = 140;
const URL_DESTINO = '/notificaciones';

// Canal PUSH (Web Push + VAPID). Sin configuración queda deshabilitado: no
// consulta la base ni envía. El payload es mínimo y sin datos sensibles (sin
// montos ni pagos): { titulo, cuerpo, url }.
@Injectable()
export class PushNotificador implements Notificador {
  readonly canal = CanalNotificacion.PUSH;
  readonly pausaMs = PAUSA_ENTRE_PUSH_MS;
  private readonly logger = new Logger(PushNotificador.name);

  constructor(
    @InjectRepository(PushSuscripcion)
    private readonly repo: Repository<PushSuscripcion>,
    private readonly config: PushConfig,
  ) {}

  async puedeNotificar(destinatario: Destinatario): Promise<boolean> {
    if (!this.config.habilitado) return false;
    try {
      const cantidad = await this.repo.count({
        where: { usuario: { id: destinatario.id } },
      });
      return cantidad > 0;
    } catch {
      this.logger.warn('No se pudieron consultar las suscripciones push');
      return false;
    }
  }

  async enviar(
    destinatario: Destinatario,
    mensaje: MensajeNotificacion,
  ): Promise<boolean> {
    const { clavePublica, clavePrivada, subject } = this.config;
    if (!clavePublica || !clavePrivada || !subject) return false;
    let suscripciones: PushSuscripcion[];
    try {
      suscripciones = await this.repo.find({
        where: { usuario: { id: destinatario.id } },
      });
    } catch {
      this.logger.warn('No se pudieron leer las suscripciones push');
      return false;
    }
    if (!suscripciones.length) return false;

    const payload = JSON.stringify({
      titulo: mensaje.titulo.slice(0, MAX_TITULO),
      cuerpo: mensaje.mensaje.slice(0, MAX_CUERPO),
      url: URL_DESTINO,
    });
    let alguna = false;
    for (const s of suscripciones) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          {
            TTL: TTL_PUSH_SEGUNDOS,
            vapidDetails: {
              subject,
              publicKey: clavePublica,
              privateKey: clavePrivada,
            },
          },
        );
        alguna = true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Suscripción vencida o revocada: se descarta.
          await this.borrar(s.id);
        } else {
          // Sin endpoint ni cuerpo del error (identifican al dispositivo).
          this.logger.warn(
            `Falló un envío push al usuario ${destinatario.id} (status ${status ?? 'desconocido'})`,
          );
        }
      }
    }
    return alguna;
  }

  private async borrar(id: string): Promise<void> {
    try {
      await this.repo.delete({ id });
    } catch {
      this.logger.warn('No se pudo borrar una suscripción push vencida');
    }
  }
}
