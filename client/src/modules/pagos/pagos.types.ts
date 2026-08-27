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
}
