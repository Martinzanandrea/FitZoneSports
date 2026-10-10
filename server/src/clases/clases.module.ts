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
import { ClaseBajaListener } from './listeners/clase-baja.listener';
import {
  BOOKING_CLASE_REPOSITORY,
  TypeOrmBookingClaseRepository,
} from './booking-clase.repository';
import { RepartoHorasService } from './reparto-horas.service';
import { GeneracionOcurrenciasService } from './generacion-ocurrencias.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

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
    NotificacionesModule, // los listeners de eventos de clases notifican con su servicio
  ],
  controllers: [ClasesController, ReservasClaseController],
  providers: [
    ClasesService,
    ReservasClaseService,
    TypeOrmBookingClaseRepository,
    {
      provide: BOOKING_CLASE_REPOSITORY,
      useClass: TypeOrmBookingClaseRepository,
    },
    ListaEsperaListener,
    ClaseBajaListener,
    RepartoHorasService,
    GeneracionOcurrenciasService,
  ],
  exports: [ClasesService, ReservasClaseService],
})
export class ClasesModule {}
