import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Clase,
  ClaseHorarioSemanal,
  ClaseOcurrencia,
  FranjaHoraria,
  Membresia,
  ReservaClase,
  Sede,
  Instructor,
  Usuario,
} from '../entities';
import { ClasesService } from './clases.service';
import { ClasesController } from './clases.controller';
import { ReservasClaseService } from './reserva-clase.service';
import { ReservasClaseController } from './reserva-clase.controller';
import { ListaEsperaListener } from './listeners/lista-espera.listener';
import { RepartoHorasService } from './reparto-horas.service';
import { GeneracionOcurrenciasService } from './generacion-ocurrencias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clase,
      ClaseHorarioSemanal,
      ClaseOcurrencia,
      FranjaHoraria,
      Membresia,
      ReservaClase,
      Sede,
      Instructor,
      Usuario,
    ]),
  ],
  controllers: [ClasesController, ReservasClaseController],
  providers: [
    ClasesService,
    ReservasClaseService,
    ListaEsperaListener,
    RepartoHorasService,
    GeneracionOcurrenciasService,
  ],
  exports: [ClasesService, ReservasClaseService],
})
export class ClasesModule {}
