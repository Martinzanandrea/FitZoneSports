//Interface for the Aforo data structure
export interface Aforo {
  actual: number;
  maximo: number;
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
