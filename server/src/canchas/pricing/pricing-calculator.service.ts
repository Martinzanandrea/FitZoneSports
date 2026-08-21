import { Injectable } from '@nestjs/common';
import { MemberDiscountPricing } from './member-discount-pricing.strategy';
import { PeakHourPricing } from './peak-hour-pricing.strategy';
import { TipoEstrategiaPrecio } from '../../entities/enums';

@Injectable()
export class PricingCalculatorService {
  constructor(
    private readonly memberDiscount: MemberDiscountPricing,
    private readonly peakHour: PeakHourPricing,
  ) {}

  calcular(
    precioBase: number,
    context: { esSocioActivo: boolean; esHoraPico: boolean },
  ): { precioFinal: number; estrategia: TipoEstrategiaPrecio } {
    let precio = precioBase;
    const aplicaDescuento = this.memberDiscount.aplica(context);
    const aplicaRecargo = this.peakHour.aplica(context);

    if (aplicaDescuento) precio = this.memberDiscount.calcular(precio);
    if (aplicaRecargo) precio = this.peakHour.calcular(precio);

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
