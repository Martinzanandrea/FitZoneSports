export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  aforoMaximo: number;
  activa: boolean;
  creadaEn: string;
}

export interface CreateSedePayload {
  nombre: string;
  direccion: string;
  aforoMaximo: number;
}

export interface FranjaHoraria {
  id: string;
  apertura: string; // "HH:MM:SS"
  cierre: string; // "HH:MM:SS"
}