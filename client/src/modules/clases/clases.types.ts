export const EstadoResClase = {
  RESERVADA: 'RESERVADA',
  LISTA_ESPERA: 'LISTA_ESPERA',
  CANCELADA: 'CANCELADA',
  ASISTIO: 'ASISTIO',
  NO_ASISTIO: 'NO_ASISTIO',
} as const;
export type EstadoResClase = (typeof EstadoResClase)[keyof typeof EstadoResClase];

export interface Clase {
  id: string;
  sede: { id: string; nombre: string };
  tipoClase: string;
  instructor: { id: string; nombre: string; especialidad?: string | null };
  horarioInicio: string;
  horarioFin: string;
  capacidad: number;
  creadaEn?: string;
}

export interface ClasePayload {
  sedeId: string;
  tipoClase: string;
  instructorId: string;
  horarioInicio: string;
  horarioFin: string;
  capacidad: number;
}

export interface ReservaClase {
  id: string;
  clase: Clase;
  usuario: { id: string; nombre: string; apellido: string };
  estado: EstadoResClase;
  notificado: boolean;
  creadaEn: string;
  canceladaEn?: string | null;
}
