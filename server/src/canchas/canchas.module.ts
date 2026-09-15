import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cancha,
  BloqueoCancha,
  ReservaCancha,
  Sede,
  Usuario,
} from '../entities';
import { MembresiasModule } from '../membresias/membresias.module';
import { CanchasService } from './canchas.service';
import { CanchasController } from './canchas.controller';
import { ReservasCanchaService } from './reserva-cancha.service';
import { ReservasCanchaController } from './reservas-cancha.controller';
import {
  BOOKING_CANCHA_REPOSITORY,
  TypeOrmBookingCanchaRepository,
} from './booking-cancha.repository';
import { PricingCalculatorService } from './pricing/pricing-calculator.service';
import { PRICING_STRATEGIES } from './pricing/pricing-strategy.interface';
import { MemberDiscountPricing } from './pricing/member-discount-pricing.strategy';
import { PeakHourPricing } from './pricing/peak-hour-pricing.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cancha,
      BloqueoCancha,
      ReservaCancha,
      Sede,
      Usuario,
    ]),
    MembresiasModule, // para leer la membresía vigente del socio (RN03)
  ],
  controllers: [CanchasController, ReservasCanchaController],
  providers: [
    CanchasService,
    ReservasCanchaService,
    TypeOrmBookingCanchaRepository,
    {
      provide: BOOKING_CANCHA_REPOSITORY,
      useClass: TypeOrmBookingCanchaRepository,
    },
    PricingCalculatorService,
    MemberDiscountPricing,
    PeakHourPricing,
    {
      provide: PRICING_STRATEGIES,
      useFactory: (
        memberDiscount: MemberDiscountPricing,
        peakHour: PeakHourPricing,
      ) => [memberDiscount, peakHour],
      inject: [MemberDiscountPricing, PeakHourPricing],
    },
  ],
  exports: [CanchasService, ReservasCanchaService],
})
export class CanchasModule {}
