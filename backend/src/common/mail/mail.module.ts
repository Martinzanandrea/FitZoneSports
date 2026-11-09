import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { crearEnviadorCorreo } from './crear-enviador';
import { ENVIADOR_CORREO } from './enviador-correo';

@Module({
  providers: [
    {
      provide: ENVIADOR_CORREO,
      inject: [ConfigService],
      useFactory: crearEnviadorCorreo,
    },
  ],
  exports: [ENVIADOR_CORREO],
})
export class MailModule {}
