import { Injectable } from '@nestjs/common';
import { PricingStrategy, PricingContext } from './pricing-strategy.interface';

@Injectable()
export class MemberDiscountPricing implements PricingStrategy {
  private readonly DESCUENTO = 0.15; // RN03: solo si la membresía está ACTIVA

  aplica(context: PricingContext): boolean {
    return context.esSocioActivo;
  }
  calcular(precioBase: number): number {
    return precioBase * (1 - this.DESCUENTO);
  }
}
