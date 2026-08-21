import { Injectable } from '@nestjs/common';
import { PricingStrategy, PricingContext } from './pricing-strategy.interface';

@Injectable()
export class StandardPricing implements PricingStrategy {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  aplica(_context: PricingContext): boolean {
    return true; // siempre es la base, antes de aplicar modificadores
  }
  calcular(precioBase: number): number {
    return precioBase;
  }
}
