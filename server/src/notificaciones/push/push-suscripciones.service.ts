import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSuscripcion, Usuario } from '../../entities';
import { PushConfig } from './push.config';
import type { SuscribirPushDto } from './push.dto';

const MAX_USER_AGENT = 300;

// Gestión de las suscripciones del propio usuario (el id siempre sale del JWT).
@Injectable()
export class PushSuscripcionesService {
  constructor(
    @InjectRepository(PushSuscripcion)
    private readonly repo: Repository<PushSuscripcion>,
    private readonly config: PushConfig,
  ) {}

  obtenerClavePublica(): { clavePublica: string } {
    if (!this.config.clavePublica) {
      throw new ServiceUnavailableException(
        'Las notificaciones push no están configuradas en el servidor',
      );
    }
    return { clavePublica: this.config.clavePublica };
  }

  // Idempotente y atómico: si el endpoint ya existe (de este u otro usuario,
  // p. ej. mismo navegador con otra sesión) queda asignado al usuario actual.
  async suscribir(
    usuarioId: string,
    dto: SuscribirPushDto,
    userAgent?: string,
  ): Promise<{ suscrito: true }> {
    await this.repo.upsert(
      {
        usuario: { id: usuarioId } as Usuario,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT) : null,
      },
      ['endpoint'],
    );
    return { suscrito: true };
  }

  // Solo borra si el endpoint es del usuario; si no existe o es de otro,
  // responde igual (no se revela de quién es).
  async desuscribir(
    usuarioId: string,
    endpoint: string,
  ): Promise<{ eliminada: boolean }> {
    const res = await this.repo.delete({
      endpoint,
      usuario: { id: usuarioId },
    });
    return { eliminada: (res.affected ?? 0) > 0 };
  }
}
