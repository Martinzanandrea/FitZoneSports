export type TipoPlan = "MENSUAL" | "TRIMESTRAL" | "ANUAL";

export interface Membresia {
  id: string;
  plan: TipoPlan;
  estado: "ACTIVO" | "VENCIDO" | "SUSPENDIDO";
  fechaInicio: string;
  fechaFin: string;
  renovacionAuto: boolean;
  sedeAlta: { id: string; nombre: string };
  creadaEn: string;
  // Presente solo cuando el backend incluye la relación (ej. GET /membresias).
  usuario?: { id: string; nombre: string; apellido: string; dni: string | null };
}

export interface CreateMembresiaPayload {
  usuarioId: string;
  sedeAltaId: string;
  plan: TipoPlan;
}
