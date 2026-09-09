import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FranjaHoraria, Sede } from '../entities';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { FranjasHorariasService } from './franjas-horarias.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sede, FranjaHoraria])],
  controllers: [SedesController],
  providers: [SedesService, FranjasHorariasService],
  exports: [SedesService], // otros módulos (usuarios, canchas, clases) van a necesitar validar que una sede existe
})
export class SedesModule {}
