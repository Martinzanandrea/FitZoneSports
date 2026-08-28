import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cancha, Clase, ReservaCancha, ReservaClase } from '../entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clase, Cancha, ReservaClase, ReservaCancha])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
