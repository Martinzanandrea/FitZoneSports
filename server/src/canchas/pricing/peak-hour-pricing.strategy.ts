import { Injectable } from '@nestjs/common';
import { PricingStrategy, PricingContext } from './pricing-strategy.interface';

@Injectable()
export class PeakHourPricing implements PricingStrategy {
  private readonly RECARGO = 0.15; // 19-21hs

  aplica(context: PricingContext): boolean {
    return context.esHoraPico;
  }
  calcular(precioBase: number): number {
    return precioBase * (1 + this.RECARGO);
  }
}
