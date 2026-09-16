import { Inject, Injectable } from '@nestjs/common';
import {
  PRICING_STRATEGIES,
  PricingContext,
  PricingStrategy,
} from './pricing-strategy.interface';
import { TipoEstrategiaPrecio } from '../../entities/enums';
// Este servicio calcula el precio final de una reserva aplicando las estrategias de precios registradas en el sistema.
@Injectable()
export class PricingCalculatorService {
  constructor(
    @Inject(PRICING_STRATEGIES)
    private readonly strategies: PricingStrategy[],
  ) {}

  calcular(
    precioBase: number,
    context: PricingContext,
  ): { precioFinal: number; estrategia: TipoEstrategiaPrecio } {
    let precio = precioBase;
    const aplicadas: string[] = [];
    for (const strategy of this.strategies) {
      if (strategy.aplica(context)) {
        precio = strategy.calcular(precio);
        aplicadas.push(strategy.constructor.name);
      }
    }

    const aplicaDescuento = aplicadas.includes('MemberDiscountPricing');
    const aplicaRecargo = aplicadas.includes('PeakHourPricing');

    let estrategia: TipoEstrategiaPrecio;
    if (aplicaDescuento && aplicaRecargo)
      estrategia = TipoEstrategiaPrecio.SOCIO_HORA_PICO;
    else if (aplicaDescuento) estrategia = TipoEstrategiaPrecio.SOCIO_DESCUENTO;
    else if (aplicaRecargo) estrategia = TipoEstrategiaPrecio.HORA_PICO;
    else estrategia = TipoEstrategiaPrecio.ESTANDAR;

    return { precioFinal: Math.round(precio * 100) / 100, estrategia };
  }

  // 19:00 a 20:59 es pico; a las 21:00 en punto ya no.
  esHoraPico(horaInicio: string): boolean {
    const hora = parseInt(horaInicio.split(':')[0], 10);
    return hora >= 19 && hora < 21;
  }
}
