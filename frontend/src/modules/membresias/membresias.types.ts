export type TipoPlan = "MENSUAL" | "TRIMESTRAL" | "ANUAL";
export type EstadoMembresia = "ACTIVO" | "VENCIDO" | "SUSPENDIDO";

// Vista recortada que devuelve GET /membresias/vigente/:id y su `proxima`:
// plan, estado y fechas, sin datos de pago. `fecha_fin` es exclusiva.
export interface MembresiaResumen {
  plan: TipoPlan;
  estado: EstadoMembresia;
  fechaInicio: string;
  fechaFin: string;
  sedeAlta: { id: string; nombre: string };
}

// GET /membresias/vigente/:id: la membresía vigente (o la última terminada o
// suspendida) y, si existe, la próxima programada.
export interface EstadoSocio extends MembresiaResumen {
  proxima: MembresiaResumen | null;
}

// Membresía completa de GET /membresias (listado del personal).
export interface Membresia extends MembresiaResumen {
  id: string;
  renovacionAuto: boolean;
  creadaEn: string;
  // Presente solo cuando el backend incluye la relación (ej. GET /membresias).
  usuario?: { id: string; nombre: string; apellido: string; dni: string | null };
}

export interface CreateMembresiaPayload {
  usuarioId: string;
  sedeAltaId: string;
  plan: TipoPlan;
}
