import { Injectable } from '@nestjs/common';
import { MetodoPago } from '../../entities/enums';

@Injectable()
export class PasarelaMockService {
  procesarPago(
    monto: number,
    metodo: MetodoPago,
  ): Promise<{ aprobado: boolean; token: string }> {
    const token = `MOCK-${metodo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return Promise.resolve({ aprobado: true, token });
  }
}
