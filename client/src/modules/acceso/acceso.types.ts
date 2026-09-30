//Interface for the Aforo data structure
export interface Aforo {
  actual: number;
  maximo: number;
}

// Un registro del historial de accesos (GET /acceso/historial/:usuarioId,
// paginado). horaEgreso null = el usuario sigue adentro.
export interface HistorialAcceso {
  id: string;
  horaIngreso: string;
  horaEgreso: string | null;
  sede: { id: string; nombre: string };
}

// Una sesión abierta (GET /acceso/dentro/:sedeId): el usuario está
// DENTRO de la sede ahora mismo. Orden: el que lleva más tiempo, primero.
export interface SesionAbierta {
  id: string;
  horaIngreso: string;
  usuario: { id: string; nombre: string; apellido: string };
}

export interface ResumenAccesoSede {
  sedeId: string;
  sede: string;
  aforoActual: number;
  aforoMaximo: number;
  ingresosHoy: number;
  egresosHoy: number;
}

export interface ResumenAccesos {
  porSede: ResumenAccesoSede[];
  totalIngresosHoy: number;
  totalEgresosHoy: number;
}
