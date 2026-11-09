import { Injectable } from '@nestjs/common';
import { PricingStrategy, PricingContext } from './pricing-strategy.interface';
// Estrategia de precios para horas pico (19-21hs):
// recargo del 15% sobre el precio base.
//Este patron de diseño permite definir diferentes
// estrategias de precios y aplicarlas según el contexto de la reserva.
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
