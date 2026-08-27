export interface PagoPasarelaPayload {
  usuarioId: string;
  membresiaId?: string;
  reservaClaseId?: string;
  reservaCanchaId?: string;
  metodo: "MERCADOPAGO" | "MODO";
  monto: number;
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
