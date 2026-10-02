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
import { PASARELA_PAGO } from './pasarela-pago.interface';
import { ComprobantesService } from './comprobantes.service';
import { PdfGeneratorService } from './comprobantes/pdf-generator.service';
import { PreciosModule } from 'src/precios/precios.module';

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
    PreciosModule,
  ],
  controllers: [PagosController],
  providers: [
    PagosService,
    // Mismo patrón que BOOKING_CANCHA/CLASE_REPOSITORY: el dominio
    // consume el token, y acá se decide la implementación.
    { provide: PASARELA_PAGO, useClass: PasarelaMockService },
    ComprobantesService,
    PdfGeneratorService,
  ],
  exports: [PagosService],
})
export class PagosModule {}
