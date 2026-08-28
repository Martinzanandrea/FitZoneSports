import { api } from '../../api/axios';
import type { Cancha, ReservaCancha, CanchaPayload } from './canchas.types';

export const canchasApi = {
  getAll: () => api.get<Cancha[]>('/canchas').then((r) => r.data),
  create: (payload: CanchaPayload) => api.post<Cancha>('/canchas', payload).then((r) => r.data),
  update: (id: string, payload: Partial<CanchaPayload> & { estado?: Cancha['estado'] }) => api.patch<Cancha>(`/canchas/${id}`, payload).then((r) => r.data),
  getReservasPorCancha: (canchaId: string, fecha?: string) =>
    api.get<ReservaCancha[]>(`/reservas-cancha/cancha/${canchaId}`, { params: fecha ? { fecha } : {} }).then((r) => r.data),
  reservar: (payload: { canchaId: string; usuarioId: string; fecha: string; horaInicio: string; horaFin: string }) =>
    api.post<ReservaCancha>('/reservas-cancha', payload).then((r) => r.data),
  cancelar: (reservaId: string) =>
    api.post<ReservaCancha>(`/reservas-cancha/${reservaId}/cancelar`).then((r) => r.data),
};
