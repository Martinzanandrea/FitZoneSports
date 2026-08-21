import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ControlAcceso, Usuario, Sede } from '../entities';
import { AccesoService } from './acceso.service';
import { AccesoController } from './acceso.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ControlAcceso, Usuario, Sede]),
    // Registramos JwtModule acá también (mismo secret que auth) para
    // poder firmar/verificar el QR sin depender de importar AuthModule
    // completo (evita acoplar acceso con toda la lógica de login).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AccesoController],
  providers: [AccesoService],
  exports: [AccesoService],
})
export class AccesoModule {}
