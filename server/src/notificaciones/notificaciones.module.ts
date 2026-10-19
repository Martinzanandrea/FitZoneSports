import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EnvioNotificacion,
  Notificacion,
  PushSuscripcion,
  Sede,
  Usuario,
} from '../entities';
import { MailModule } from '../common/mail/mail.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { NOTIFICADORES } from './notificaciones.types';
import { NotificadorFactory } from './notificadores/notificador.factory';
import { PanelNotificador } from './notificadores/panel.notificador';
import { EmailNotificador } from './notificadores/email.notificador';
import { PushNotificador } from './notificadores/push.notificador';
import { PushConfig } from './push/push.config';
import { PushController } from './push/push.controller';
import { PushSuscripcionesService } from './push/push-suscripciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notificacion,
      EnvioNotificacion,
      PushSuscripcion,
      Usuario,
      Sede,
    ]),
    MailModule, // EnviadorCorreo: proveedor de mail según MAIL_PROVIDER
  ],
  controllers: [NotificacionesController, PushController],
  providers: [
    NotificacionesService,
    NotificadorFactory,
    // Soporte del canal PUSH: configuración VAPID y gestión de suscripciones.
    PushConfig,
    PushSuscripcionesService,
    // ── Canales de notificación ──
    // Único lugar donde se "enchufa" un canal: registrar su clase como provider
    // y sumarla a la lista de NOTIFICADORES. La fábrica y los consumidores no
    // se editan.
    PanelNotificador,
    EmailNotificador,
    PushNotificador,
    {
      provide: NOTIFICADORES,
      useFactory: (
        panel: PanelNotificador,
        email: EmailNotificador,
        push: PushNotificador,
      ) => [panel, email, push],
      inject: [PanelNotificador, EmailNotificador, PushNotificador],
    },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
