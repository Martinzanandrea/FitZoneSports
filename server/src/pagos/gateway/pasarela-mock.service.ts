import { Injectable } from '@nestjs/common';
import { MetodoPago } from '../../entities/enums';

@Injectable()
export class PasarelaMockService {
  async procesarPago(
    monto: number,
    metodo: MetodoPago,
    forzarRechazo = false,
  ): Promise<{ aprobado: boolean; token: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const token = `MOCK-${metodo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return { aprobado: !forzarRechazo, token };
  }
}
