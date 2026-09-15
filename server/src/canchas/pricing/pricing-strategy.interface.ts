export interface PricingContext {
  esSocioActivo: boolean;
  esHoraPico: boolean;
}

// La interfaz común que exige el patrón Strategy (GoF).
export interface PricingStrategy {
  aplica(context: PricingContext): boolean;
  calcular(precioBase: number): number;
}

export const PRICING_STRATEGIES = 'PRICING_STRATEGIES';
