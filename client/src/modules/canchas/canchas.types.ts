export const TipoCancha = {
  PADDLE: 'PADDLE',
  FUTBOL5: 'FUTBOL5',
} as const;
export type TipoCancha = (typeof TipoCancha)[keyof typeof TipoCancha];

export const EstadoCancha = {
  ACTIVA: 'ACTIVA',
  MANTENIMIENTO: 'MANTENIMIENTO',
} as const;
export type EstadoCancha = (typeof EstadoCancha)[keyof typeof EstadoCancha];

export const EstadoResCancha = {
  CONFIRMADA: 'CONFIRMADA',
  CANCELADA: 'CANCELADA',
} as const;
export type EstadoResCancha = (typeof EstadoResCancha)[keyof typeof EstadoResCancha];

export const TipoEstrategiaPrecio = {
  ESTANDAR: 'ESTANDAR',
  SOCIO_DESCUENTO: 'SOCIO_DESCUENTO',
  HORA_PICO: 'HORA_PICO',
  SOCIO_HORA_PICO: 'SOCIO_HORA_PICO',
} as const;
export type TipoEstrategiaPrecio = (typeof TipoEstrategiaPrecio)[keyof typeof TipoEstrategiaPrecio];

export interface Cancha {
  id: string;
  sede: { id: string; nombre: string };
  nombre: string;
  tipo: TipoCancha;
  costoHoraBase: string;
  estado: EstadoCancha;
  creadaEn?: string;
}

export interface ReservaCancha {
  id: string;
  cancha: Cancha;
  usuario: { id: string; nombre: string; apellido: string };
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precioFinal: string;
  estrategiaPrecio: TipoEstrategiaPrecio;
  estado: EstadoResCancha;
  creadaEn: string;
  canceladaEn?: string | null;
}
