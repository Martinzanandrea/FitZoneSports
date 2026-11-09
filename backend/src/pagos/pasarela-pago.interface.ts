import { MetodoPago } from '../entities/enums';

// Forma real que devuelve procesarPago hoy (ver
// gateway/pasarela-mock.service.ts): no se inventa nada.
export interface ResultadoPasarela {
  aprobado: boolean;
  token: string;
}

// Adapter (GoF) para pasarelas de pago: el dominio depende de esta
// interfaz, y cada pasarela (mock, MercadoPago, Modo) la implementa.
// Mismo patrón que BOOKING_CANCHA/CLASE_REPOSITORY.
export interface PasarelaPago {
  procesarPago(
    monto: number,
    metodo: MetodoPago,
    forzarRechazo?: boolean,
  ): Promise<ResultadoPasarela>;
}

export const PASARELA_PAGO = 'PASARELA_PAGO';
