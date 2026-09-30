import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsuariosService } from './usuarios.service';
import { EmailVerificacionService } from './email-verificacion.service';
import { UsuariosController } from './usuarios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../entities/usuario.entity';
import { StorageModule } from '../storage/storage.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    StorageModule,
    // JwtModule propio (mismo JWT_SECRET que auth): evita ciclo
    // AuthModule -> UsuariosModule -> AuthModule.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService, EmailVerificacionService],
  exports: [UsuariosService], // otros módulos (acceso, membresias, reservas) van a necesitar validar que un usuario existe,por eso se exporta el service
})
export class UsuariosModule {}
