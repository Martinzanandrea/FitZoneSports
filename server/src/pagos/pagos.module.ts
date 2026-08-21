import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Pago,
  Comprobante,
  Usuario,
  Membresia,
  ReservaClase,
  ReservaCancha,
} from '../entities';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { PasarelaMockService } from './gateway/pasarela-mock.service';
import { ComprobantesService } from './comprobantes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pago,
      Comprobante,
      Usuario,
      Membresia,
      ReservaClase,
      ReservaCancha,
    ]),
  ],
  controllers: [PagosController],
  providers: [PagosService, PasarelaMockService, ComprobantesService],
  exports: [PagosService],
})
export class PagosModule {}
