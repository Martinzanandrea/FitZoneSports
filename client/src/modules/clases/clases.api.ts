import { api } from '../../api/axios';
import type { Clase, ReservaClase, ClasePayload } from './clases.types';

export const clasesApi = {
  getAll: () => api.get<Clase[]>('/clases').then((r) => r.data),
  create: (payload: ClasePayload) => api.post<Clase>('/clases', payload).then((r) => r.data),
  update: (id: string, payload: Partial<ClasePayload>) => api.patch<Clase>(`/clases/${id}`, payload).then((r) => r.data),
  reservar: (claseId: string, usuarioId: string) =>
    api.post<ReservaClase>(`/clases/${claseId}/reservas`, { usuarioId }).then((r) => r.data),
  cancelar: (reservaId: string) =>
    api.post<ReservaClase>(`/clases/reservas/${reservaId}/cancelar`).then((r) => r.data),
  getReservasPorClase: (claseId: string) =>
    api.get<ReservaClase[]>(`/clases/${claseId}/reservas`).then((r) => r.data),
};
