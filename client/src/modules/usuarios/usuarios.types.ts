import { TipoActor } from "../../shared/types/enums";

export interface Usuario {
  id: string;
  tipoActor: TipoActor;
  dni: string | null;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  fotoUrl: string | null;
  activo: boolean;
  creadoEn: string;
  sede?: { id: string; nombre: string } | null;
}

export interface CrearStaffPayload {
  tipoActor: typeof TipoActor.RECEPCIONISTA | typeof TipoActor.GERENTE;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  sedeId?: string;
}
