import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membresia, Usuario, Sede } from '../entities';
import { MembresiasService } from './membresias.service';
import { MembresiasController } from './membresias.controller';

@Module({
  // Usuario y Sede entran también porque el service necesita validar
  // que existan antes de crear la membresía (no solo guardar Membresia).
  imports: [TypeOrmModule.forFeature([Membresia, Usuario, Sede])],
  controllers: [MembresiasController],
  providers: [MembresiasService],
  exports: [MembresiasService], // pagos y canchas (RN03) van a necesitar leer el estado de una membresía
})
export class MembresiasModule {}
