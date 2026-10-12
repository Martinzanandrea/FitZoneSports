import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvioNotificacion, Notificacion, Sede, Usuario } from '../entities';
import { MailModule } from '../common/mail/mail.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
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
    PanelNotificador,
    EmailNotificador,
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
