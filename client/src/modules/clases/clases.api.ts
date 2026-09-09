import { api } from '../../api/axios';
import type {
  Clase,
  ClaseHorarioSemanal,
  ClaseOcurrencia,
  ReservaClase,
} from './clases.types';

// El backend manda la grilla como "horariosSemanales" y las horas como texto
// (columna numeric); acá se normaliza a la forma que usan las pantallas.
type ClaseCruda = Omit<Clase, 'horarios' | 'horasSemanalesTotales'> & {
  horariosSemanales?: ClaseHorarioSemanal[];
  horasSemanalesTotales: number | string;
};

function normalizarClase(c: ClaseCruda): Clase {
  const { horariosSemanales, horasSemanalesTotales, ...resto } = c;
  return {
    ...resto,
    horarios: horariosSemanales ?? [],
    horasSemanalesTotales: Number(horasSemanalesTotales),
  };
}

export interface HorarioClasePayload {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface CrearClasePayload {
  sedeId: string;
  tipoClase: string;
  instructorId: string;
  capacidad: number;
  horasSemanalesTotales: number;
  horarios: HorarioClasePayload[];
}

export interface SugerenciaReparto {
  viable: boolean;
  motivo?: string;
  horarios: Array<{
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    horas: number;
  }>;
}

export const clasesApi = {
  // Trae las plantillas de clases (no los horarios sueltos); si se pasa una
  // sede, devuelve solo las de esa sede.
  getAll: (sedeId?: string) =>
    api.get<ClaseCruda[]>('/clases', { params: sedeId ? { sedeId } : {} }).then((r) => r.data.map(normalizarClase)),
  // Trae el detalle de una clase con su grilla semanal; el id dice cuál.
  getOne: (id: string) =>
    api.get<ClaseCruda>(`/clases/${id}`).then((r) => normalizarClase(r.data)),
  // Trae las fechas concretas generadas de una clase (el claseId dice cuál);
  // desde/hasta recortan el rango con formato "YYYY-MM-DD" y son opcionales.
  getOcurrencias: (claseId: string, desde?: string, hasta?: string) =>
    api
      .get<ClaseOcurrencia[]>(`/clases/${claseId}/ocurrencias`, { params: { desde, hasta } })
      .then((r) => r.data),
  // Crea una clase con su grilla semanal ya confirmada (pasó por la sugerencia
  // + edición antes de llegar acá) — solo para gerentes.
  crear: (payload: CrearClasePayload) =>
    api.post<ClaseCruda>('/clases', payload).then((r) => normalizarClase(r.data)),
  // Desactiva una clase (el id dice cuál); lo ya generado y reservado queda intacto.
  desactivar: (id: string) => api.delete(`/clases/${id}`).then((r) => r.data),
  // Le cambia el instructor a una clase; el claseId dice cuál clase y el instructorId quién la va a dar.
  asignarInstructor: (claseId: string, instructorId: string) =>
    api.patch<ClaseCruda>(`/clases/${claseId}/instructor`, { instructorId }).then((r) => normalizarClase(r.data)),
  // Pide una sugerencia de días y horarios para una carga horaria (no guarda
  // nada, solo calcula); sirve para armar la grilla antes de crear la clase.
  sugerirReparto: (sedeId: string, horasSemanales: number, numDias: number) =>
    api
      .get<SugerenciaReparto>('/clases/reparto-sugerido', { params: { sedeId, horasSemanales, numDias } })
      .then((r) => r.data),
  // Anota a un usuario en una fecha concreta (el ocurrenciaId dice en cuál);
  // si está llena, queda en lista de espera y le avisan cuando se libera un lugar.
  reservar: (ocurrenciaId: string, usuarioId: string) =>
    api.post<ReservaClase>(`/clases/ocurrencias/${ocurrenciaId}/reservas`, { usuarioId }).then((r) => r.data),
  // Trae quiénes están anotados (y en espera) en una fecha concreta; el ocurrenciaId dice cuál.
  getReservasPorOcurrencia: (ocurrenciaId: string) =>
    api.get<ReservaClase[]>(`/clases/ocurrencias/${ocurrenciaId}/reservas`).then((r) => r.data),
  // Cancela la inscripción a una clase (el reservaId dice cuál); si había gente
  // en espera, se promueve sola a la primera.
  cancelarReserva: (reservaId: string) =>
    api.post<ReservaClase>(`/clases/reservas/${reservaId}/cancelar`).then((r) => r.data),
};
