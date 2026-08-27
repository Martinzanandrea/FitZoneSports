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
}

export interface CreateMembresiaPayload {
  usuarioId: string;
  sedeAltaId: string;
  plan: TipoPlan;
}
