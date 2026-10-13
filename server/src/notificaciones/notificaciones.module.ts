import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvioNotificacion, Notificacion, Sede, Usuario } from '../entities';
import { MailModule } from '../common/mail/mail.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { NOTIFICADORES } from './notificaciones.types';
import { NotificadorFactory } from './notificadores/notificador.factory';
import { PanelNotificador } from './notificadores/panel.notificador';
import { EmailNotificador } from './notificadores/email.notificador';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notificacion, EnvioNotificacion, Usuario, Sede]),
    MailModule, // EnviadorCorreo: proveedor de mail según MAIL_PROVIDER
  ],
  controllers: [NotificacionesController],
  providers: [
    NotificacionesService,
    NotificadorFactory,
    // ── Canales de notificación ──
    // Único lugar donde se "enchufa" un canal: registrar su clase como provider
    // y sumarla a la lista de NOTIFICADORES. La fábrica y los consumidores no
    // se editan.
    PanelNotificador,
    EmailNotificador,
    {
      provide: NOTIFICADORES,
      useFactory: (panel: PanelNotificador, email: EmailNotificador) => [
        panel,
        email,
      ],
      inject: [PanelNotificador, EmailNotificador],
    },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
