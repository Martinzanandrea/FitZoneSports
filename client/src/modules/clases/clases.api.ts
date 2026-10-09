import { api } from '../../api/axios';
import type { PaginatedResponse } from '../../shared/types/pagination';
import type {
  Clase,
  ClaseHorarioSemanal,
  ClaseOcurrencia,
  MiReservaClase,
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

export interface ResumenClasePublica {
  tipoClase: string;
  sedesQueOfrecen: number;
  horasSemanalesTotales: number;
}

export const clasesApi = {
  // Catálogo público agregado por tipo (sin login): por cada tipo de
  // clase activa, cuántas sedes lo ofrecen y la carga horaria total.
  getAllPublico: () =>
    api.get<ResumenClasePublica[]>('/clases/publico').then((r) => r.data),
  // Trae las plantillas de clases (no los horarios sueltos); si se pasa una
  // sede, devuelve solo las de esa sede. Viene paginado: page arranca
  // en 1 y limit trae 20 por defecto.
  getAll: (sedeId?: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<ClaseCruda>>('/clases', { params: { ...(sedeId ? { sedeId } : {}), page, limit } }).then((r) => ({ ...r.data, data: r.data.data.map(normalizarClase) })),
  // Trae el detalle de una clase con su grilla semanal; el id dice cuál.
  getOne: (id: string) =>
    api.get<ClaseCruda>(`/clases/${id}`).then((r) => normalizarClase(r.data)),
  // Trae las fechas concretas generadas de una clase (el claseId dice cuál);
  // desde/hasta recortan el rango con formato "YYYY-MM-DD" y son opcionales.
  // También viene paginado.
  getOcurrencias: (claseId: string, desde?: string, hasta?: string, page = 1, limit = 20) =>
    api
      .get<PaginatedResponse<ClaseOcurrencia>>(`/clases/${claseId}/ocurrencias`, { params: { desde, hasta, page, limit } })
      .then((r) => r.data),
  // Crea una clase con su grilla semanal ya confirmada (pasó por la sugerencia
  // + edición antes de llegar acá) — solo para gerentes.
  crear: (payload: CrearClasePayload) =>
    api
      .post<ClaseCruda & { ocurrenciasGeneradas: boolean }>('/clases', payload)
      .then((r) => ({ ...normalizarClase(r.data), ocurrenciasGeneradas: r.data.ocurrenciasGeneradas })),
  // Reintenta generar las fechas de una clase (idempotente); GG o GS con scope.
  generarOcurrencias: (id: string) =>
    api.post<{ claseId: string; ocurrenciasGeneradas: number }>(`/clases/${id}/generar-ocurrencias`).then((r) => r.data),
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
  // Mis reservas activas (RESERVADA / LISTA_ESPERA). El backend toma el
  // usuario del token; desde = "YYYY-MM-DD" recorta por fecha de la clase.
  getMisReservas: (desde?: string, page = 1, limit = 100) =>
    api
      .get<PaginatedResponse<MiReservaClase>>('/clases/reservas/mias', { params: { ...(desde ? { desde } : {}), page, limit } })
      .then((r) => r.data),
  // Trae quiénes están anotados (y en espera) en una fecha concreta; el ocurrenciaId dice cuál.
  // Viene paginado: page arranca en 1 y limit trae 20 por defecto.
  getReservasPorOcurrencia: (ocurrenciaId: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<ReservaClase>>(`/clases/ocurrencias/${ocurrenciaId}/reservas`, { params: { page, limit } }).then((r) => r.data),
  // Cancela la inscripción a una clase (el reservaId dice cuál); si había gente
  // en espera, se promueve sola a la primera.
  cancelarReserva: (reservaId: string) =>
    api.post<ReservaClase>(`/clases/reservas/${reservaId}/cancelar`).then((r) => r.data),
};

function aYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Plantillas + ocurrencias en ventana de días (cada una con su cupoOcupado
// agregado). Una clase que falla aporta lista vacía, no rompe el resto.
export async function fetchMapaClases(ventanaDias = 14): Promise<{
  clases: Clase[];
  occMap: Record<string, ClaseOcurrencia[]>;
}> {
  const clasesRes = await clasesApi.getAll(undefined, 1, 100);
  const clases = clasesRes.data;
  const hoy = aYMD(new Date());
  const hasta = aYMD(new Date(Date.now() + ventanaDias * 24 * 60 * 60 * 1000));
  const occMap: Record<string, ClaseOcurrencia[]> = {};
  await Promise.all(
    clases.map(async (c) => {
      try {
        occMap[c.id] = (await clasesApi.getOcurrencias(c.id, hoy, hasta)).data;
      } catch {
        occMap[c.id] = [];
      }
    }),
  );
  return { clases, occMap };
}
