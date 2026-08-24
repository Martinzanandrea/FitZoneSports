// Debe reflejar EXACTAMENTE los enums de server/src/entities/enums.ts

export const TipoActor = {
  SOCIO: 'SOCIO',
  EXTERNO: 'EXTERNO',
  RECEPCIONISTA: 'RECEPCIONISTA',
  GERENTE: 'GERENTE',
} as const;
export type TipoActor = (typeof TipoActor)[keyof typeof TipoActor];

export const EstadoMembresia = {
  ACTIVO: 'ACTIVO',
  VENCIDO: 'VENCIDO',
  SUSPENDIDO: 'SUSPENDIDO',
} as const;
export type EstadoMembresia = (typeof EstadoMembresia)[keyof typeof EstadoMembresia];

export const TipoPlan = {
  MENSUAL: 'MENSUAL',
  TRIMESTRAL: 'TRIMESTRAL',
  ANUAL: 'ANUAL',
} as const;
export type TipoPlan = (typeof TipoPlan)[keyof typeof TipoPlan];

export const TipoCancha = {
  PADDLE: 'PADDLE',
  FUTBOL5: 'FUTBOL5',
} as const;
export type TipoCancha = (typeof TipoCancha)[keyof typeof TipoCancha];

export const EstadoResClase = {
  RESERVADA: 'RESERVADA',
  LISTA_ESPERA: 'LISTA_ESPERA',
  CANCELADA: 'CANCELADA',
  ASISTIO: 'ASISTIO',
  NO_ASISTIO: 'NO_ASISTIO',
} as const;
export type EstadoResClase = (typeof EstadoResClase)[keyof typeof EstadoResClase];

export const MetodoPago = {
  MERCADOPAGO: 'MERCADOPAGO',
  MODO: 'MODO',
  EFECTIVO: 'EFECTIVO',
} as const;
export type MetodoPago = (typeof MetodoPago)[keyof typeof MetodoPago];