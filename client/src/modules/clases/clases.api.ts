import { api } from '../../api/axios';
import type { Clase, ReservaClase, ClasePayload } from './clases.types';

export const clasesApi = {
  // Trae la agenda de clases grupales disponibles.
  getAll: () => api.get<Clase[]>('/clases').then((r) => r.data),
  // Crea una clase nueva en la agenda (tipo, instructor, horario y capacidad) — solo para gerentes.
  create: (payload: ClasePayload) => api.post<Clase>('/clases', payload).then((r) => r.data),
  // Guarda cambios en una clase (el id dice cuál); solo se manda lo que cambió.
  update: (id: string, payload: Partial<ClasePayload>) => api.patch<Clase>(`/clases/${id}`, payload).then((r) => r.data),
  // Le cambia el instructor a una clase; el claseId dice cuál clase y el instructorId quién la va a dar.
  asignarInstructor: (claseId: string, instructorId: string) =>
    api.patch<Clase>(`/clases/${claseId}/instructor`, { instructorId }).then((r) => r.data),
  // Anota a un usuario en una clase (el claseId dice en cuál); si está llena,
  // queda en lista de espera y le avisan cuando se libera un lugar.
  reservar: (claseId: string, usuarioId: string) =>
    api.post<ReservaClase>(`/clases/${claseId}/reservas`, { usuarioId }).then((r) => r.data),
  // Cancela la inscripción a una clase (el reservaId dice cuál); si había gente
  // en espera, se promueve sola a la primera.
  cancelar: (reservaId: string) =>
    api.post<ReservaClase>(`/clases/reservas/${reservaId}/cancelar`).then((r) => r.data),
  // Trae quiénes están anotados (y en espera) en una clase; el claseId dice cuál.
  getReservasPorClase: (claseId: string) =>
    api.get<ReservaClase[]>(`/clases/${claseId}/reservas`).then((r) => r.data),
};
