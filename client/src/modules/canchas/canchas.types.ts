export interface TipoCanchaCatalogo {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  activo: boolean;
  creadoEn?: string;
}

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
  tipoId: string;
  tipo: TipoCanchaCatalogo;
  costoHoraBase: string;
  estado: EstadoCancha;
  creadaEn?: string;
}

export interface CanchaPayload {
  sedeId: string;
  nombre: string;
  tipoId: string;
  costoHoraBase: number;
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
