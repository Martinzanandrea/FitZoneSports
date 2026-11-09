// Reglas vigentes de las clases. Una sola fuente: las usan los servicios y las
// publica GET /clases/reglas para que la pantalla de configuración no las
// repita a mano.

/** Un socio reserva hasta N horas antes del inicio. */
export const HORAS_LIMITE_RESERVA_PROPIA = 48;
/** El staff que anota a otra persona puede hacerlo hasta N minutos antes. */
export const MINUTOS_LIMITE_RESERVA_STAFF = 30;
/** Se cancela una reserva hasta N horas antes del inicio. */
export const HORAS_LIMITE_CANCELACION = 2;
/** Ventana de ocurrencias que se mantiene generada hacia adelante. */
export const SEMANAS_VENTANA_OCURRENCIAS = 4;

export interface ReglasClases {
  horasLimiteReservaPropia: number;
  minutosLimiteReservaStaff: number;
  horasLimiteCancelacion: number;
  semanasVentanaOcurrencias: number;
}

export function reglasVigentes(): ReglasClases {
  return {
    horasLimiteReservaPropia: HORAS_LIMITE_RESERVA_PROPIA,
    minutosLimiteReservaStaff: MINUTOS_LIMITE_RESERVA_STAFF,
    horasLimiteCancelacion: HORAS_LIMITE_CANCELACION,
    semanasVentanaOcurrencias: SEMANAS_VENTANA_OCURRENCIAS,
  };
}
