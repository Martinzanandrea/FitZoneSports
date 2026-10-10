import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Usuario } from '../../entities';
import { TipoActor } from '../../entities/enums';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import {
  CanalNotificacion,
  TipoNotificacion,
  type Destinatario,
  type MensajeNotificacion,
} from '../../notificaciones/notificaciones.types';
import {
  CLASE_DADA_DE_BAJA,
  type ClaseDadaDeBajaPayload,
  type OcurrenciaAfectada,
} from '../events/clase.events';

const MAX_FECHAS_EN_MENSAJE = 6;
const MAX_LARGO_MENSAJE = 1000;

function fechaCorta(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

// Observer: reacciona al evento 'clase.dada-de-baja' (emitido después de
// confirmada la transacción) y avisa a cada socio afectado, una sola vez por
// clase, con las fechas y horarios que perdió. No conoce los canales: usa
// NotificacionesService.
@Injectable()
export class ClaseBajaListener {
  private readonly logger = new Logger(ClaseBajaListener.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly notificaciones: NotificacionesService,
  ) {}

  @OnEvent(CLASE_DADA_DE_BAJA)
  async notificarSociosAfectados(
    payload: ClaseDadaDeBajaPayload,
  ): Promise<void> {
    // Un fallo acá nunca revierte la baja (ya está confirmada) ni se propaga.
    try {
      if (!payload.afectados.length) return;
      const usuarios = await this.usuariosRepo.find({
        where: { id: In(payload.afectados.map((a) => a.usuarioId)) },
      });
      const porId = new Map(usuarios.map((u) => [u.id, u]));
      const items: Array<{
        destinatario: Destinatario;
        mensaje: MensajeNotificacion;
      }> = [];
      for (const afectado of payload.afectados) {
        const u = porId.get(afectado.usuarioId);
        // Solo socios activos tienen campanita.
        if (!u || u.tipoActor !== TipoActor.SOCIO || !u.activo) continue;
        items.push({
          destinatario: {
            id: u.id,
            nombre: u.nombre,
            email: u.email ?? null,
            emailVerificado: !!u.emailVerificado,
          },
          mensaje: this.armarMensaje(payload.tipoClase, afectado.ocurrencias),
        });
      }
      await this.notificaciones.notificarPersonalizado(items, [
        CanalNotificacion.PANEL,
        CanalNotificacion.EMAIL,
      ]);
    } catch {
      this.logger.warn(
        'No se pudo avisar a los socios de una clase dada de baja',
      );
    }
  }

  private armarMensaje(
    tipoClase: string,
    ocurrencias: OcurrenciaAfectada[],
  ): MensajeNotificacion {
    const ordenadas = [...ocurrencias].sort((a, b) =>
      `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`),
    );
    const lineas = ordenadas
      .slice(0, MAX_FECHAS_EN_MENSAJE)
      .map(
        (o) =>
          `- ${fechaCorta(o.fecha)} de ${o.horaInicio.slice(0, 5)} a ${o.horaFin.slice(0, 5)}`,
      );
    const resto = ordenadas.length - lineas.length;
    if (resto > 0) lineas.push(`- y ${resto} más`);
    const base = `Tu clase ${tipoClase} fue cancelada. Podés reservar en los horarios disponibles.`;
    const mensaje = lineas.length
      ? `${base}\nHorarios afectados:\n${lineas.join('\n')}`
      : base;
    return {
      tipo: TipoNotificacion.CLASE_CANCELADA,
      titulo: `Clase cancelada: ${tipoClase}`.slice(0, 120),
      mensaje: mensaje.slice(0, MAX_LARGO_MENSAJE),
    };
  }
}
