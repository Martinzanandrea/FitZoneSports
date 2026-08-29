import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cancha,
  Clase,
  Membresia,
  Pago,
  ReservaCancha,
  ReservaClase,
  Sede,
} from '../entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clase,
      Cancha,
      ReservaClase,
      ReservaCancha,
      Pago,
      Membresia,
      Sede,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
