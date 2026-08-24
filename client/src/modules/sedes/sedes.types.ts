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