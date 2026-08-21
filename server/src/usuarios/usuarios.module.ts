import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../entities/usuario.entity';
import { StorageModule } from '../storage/storage.module';
@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), StorageModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService], // otros módulos (acceso, membresias, reservas) van a necesitar validar que un usuario existe,por eso se exporta el service
})
export class UsuariosModule {}
