// Estos enums deben coincidir EXACTAMENTE (nombre y valores) con los
// CREATE TYPE ... AS ENUM del schema SQL (fitzone_schema.sql).
// Si agregás un valor acá, agregalo también en una migración ALTER TYPE.

export enum TipoActor {
  SOCIO = 'SOCIO',
  EXTERNO = 'EXTERNO',
  RECEPCIONISTA = 'RECEPCIONISTA',
  GERENTE = 'GERENTE',
}

export enum TipoPlan {
  MENSUAL = 'MENSUAL',
  TRIMESTRAL = 'TRIMESTRAL',
  ANUAL = 'ANUAL',
}

export enum EstadoMembresia {
  ACTIVO = 'ACTIVO',
  VENCIDO = 'VENCIDO',
  SUSPENDIDO = 'SUSPENDIDO',
}

export enum TipoCancha {
  PADDLE = 'PADDLE',
  FUTBOL5 = 'FUTBOL5',
}

export enum EstadoCancha {
  ACTIVA = 'ACTIVA',
  MANTENIMIENTO = 'MANTENIMIENTO',
}

export enum EstadoResClase {
  RESERVADA = 'RESERVADA',
  LISTA_ESPERA = 'LISTA_ESPERA',
  CANCELADA = 'CANCELADA',
  ASISTIO = 'ASISTIO',
  NO_ASISTIO = 'NO_ASISTIO',
}

export enum EstadoResCancha {
  CONFIRMADA = 'CONFIRMADA',
  CANCELADA = 'CANCELADA',
}

export enum EstadoPago {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum MetodoPago {
  MERCADOPAGO = 'MERCADOPAGO',
  MODO = 'MODO',
}

export enum TipoEstrategiaPrecio {
  ESTANDAR = 'ESTANDAR',
  SOCIO_DESCUENTO = 'SOCIO_DESCUENTO',
  HORA_PICO = 'HORA_PICO',
  SOCIO_HORA_PICO = 'SOCIO_HORA_PICO',
}
