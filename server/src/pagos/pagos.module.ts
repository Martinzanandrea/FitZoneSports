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
import { StorageModule } from '../storage/storage.module';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { PasarelaMockService } from './gateway/pasarela-mock.service';
import { ComprobantesService } from './comprobantes.service';
import { PdfGeneratorService } from './comprobantes/pdf-generator.service';

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
    StorageModule,
  ],
  controllers: [PagosController],
  providers: [
    PagosService,
    PasarelaMockService,
    ComprobantesService,
    PdfGeneratorService,
  ],
  exports: [PagosService],
})
export class PagosModule {}
