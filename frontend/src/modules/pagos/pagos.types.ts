export interface PagoPasarelaPayload {
  usuarioId: string;
  /** Plan a contratar o renovar: la membresía se crea al aprobarse el pago. */
  plan?: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  /** Sede de alta (una renovación conserva la suya). */
  sedeAltaId?: string;
  reservaCanchaId?: string;
  metodo: "MERCADOPAGO" | "MODO";
  monto?: number;
  simularRechazo?: boolean;
}

export interface Pago {
  id: string;
  metodo: string;
  monto: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  creadoEn: string;
  comprobante?: { id: string; pdfPath: string; generadoEn: string } | null;
  membresia?: { id: string } | null;
  reservaClase?: { id: string } | null;
  reservaCancha?: { id: string } | null;
}

export type MetodoHistorial = "EFECTIVO" | "ONLINE";
export type TipoHistorial = "MEMBRESIA" | "CANCHA";

export interface FiltrosHistorialPagos {
  page: number;
  limit?: number;
  desde?: string;
  hasta?: string;
  metodo?: MetodoHistorial;
  tipo?: TipoHistorial;
  estado?: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  q?: string;
  sedeId?: string;
}

/** Fila de GET /pagos (personal). */
export interface PagoHistorial {
  id: string;
  fecha: string;
  cliente: { id: string; nombre: string; apellido: string };
  concepto: string;
  tipo: string;
  metodo: string;
  monto: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  sede: { id: string; nombre: string } | null;
  cobradoPor: string | null;
  comprobanteId: string | null;
}

export interface TotalesHistorial {
  cantidad: number;
  montoAprobado: string;
  montoEfectivo: string;
  montoOnline: string;
}

/** Fila de GET /pagos/mias (Socio y Externo): sin datos de terceros. */
export interface PagoPropio {
  id: string;
  fecha: string;
  concepto: string;
  tipo: string;
  metodo: string;
  monto: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  comprobanteId: string | null;
}
