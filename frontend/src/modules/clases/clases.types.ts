export interface ClaseHorarioSemanal {
  id: string;
  diaSemana: number; // 0=domingo ... 6=sábado (igual que Date.getDay() del backend)
  horaInicio: string; // "HH:MM"
  horaFin: string;
}

export interface Clase {
  id: string;
  sede: { id: string; nombre: string };
  tipoClase: string;
  instructor: { id: string; nombre: string };
  capacidad: number;
  horasSemanalesTotales: number;
  activa: boolean;
  horarios: ClaseHorarioSemanal[];
}

export interface ClaseOcurrencia {
  id: string;
  claseId: string;
  fecha: string; // "YYYY-MM-DD"
  horaInicio: string;
  horaFin: string;
  estado: 'PROGRAMADA' | 'CANCELADA';
  // Conteo agregado de reservas RESERVADA (el backend no expone las ajenas).
  cupoOcupado?: number;
}

export type EstadoResClase = 'RESERVADA' | 'LISTA_ESPERA' | 'CANCELADA' | 'ASISTIO' | 'NO_ASISTIO';

export interface ReservaClase {
  id: string;
  ocurrencia: ClaseOcurrencia & { clase: Clase };
  usuario: { id: string; nombre: string; apellido: string };
  estado: EstadoResClase;
  creadaEn: string;
}

// Reserva propia (GET /clases/reservas/mias): sin datos de usuario; trae
// sede e instructor de la clase.
export interface MiReservaClase {
  id: string;
  estado: EstadoResClase;
  creadaEn: string;
  ocurrencia: {
    id: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    estado: 'PROGRAMADA' | 'CANCELADA';
    clase: {
      id: string;
      tipoClase: string;
      sede: { id: string; nombre: string };
      instructor: { id: string; nombre: string };
    };
  };
}
