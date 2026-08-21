import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clase, ReservaClase, Sede, Instructor, Usuario } from '../entities';
import { ClasesService } from './clases.service';
import { ClasesController } from './clases.controller';
import { ReservasClaseService } from './reserva-clase.service';
import { ReservasClaseController } from './reserva-clase.controller';
import { ListaEsperaListener } from './listeners/lista-espera.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clase, ReservaClase, Sede, Instructor, Usuario]),
  ],
  controllers: [ClasesController, ReservasClaseController],
  providers: [ClasesService, ReservasClaseService, ListaEsperaListener],
  exports: [ClasesService, ReservasClaseService],
})
export class ClasesModule {}
