import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion, Usuario } from '../../entities';
import type {
  Destinatario,
  MensajeNotificacion,
  Notificador,
} from '../notificaciones.types';

// Canal PANEL: guarda una fila en `notificaciones` por destinatario (es lo que
// lee la campanita del Socio).
@Injectable()
export class PanelNotificador implements Notificador {
  private readonly logger = new Logger(PanelNotificador.name);

  constructor(
    @InjectRepository(Notificacion)
    private readonly repo: Repository<Notificacion>,
  ) {}

  async enviar(
    destinatario: Destinatario,
    mensaje: MensajeNotificacion,
  ): Promise<boolean> {
    try {
      await this.repo.save(
        this.repo.create({
          usuario: { id: destinatario.id } as Usuario,
          tipo: mensaje.tipo,
          titulo: mensaje.titulo,
          mensaje: mensaje.mensaje,
          envio: mensaje.envioId ? ({ id: mensaje.envioId } as never) : null,
        }),
      );
      return true;
    } catch {
      // Sin datos personales en el log.
      this.logger.warn('No se pudo guardar una notificación del panel');
      return false;
    }
  }
}
