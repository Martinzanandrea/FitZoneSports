import { api } from '../../api/axios';
import type { Cancha, ReservaCancha, CanchaPayload } from './canchas.types';

export const canchasApi = {
  // Le pide al backend la lista de canchas (el propio backend ya filtra según el rol).
  getAll: () => api.get<Cancha[]>('/canchas').then((r) => r.data),
  // Da de alta una cancha nueva en una sede — solo para gerentes.
  create: (payload: CanchaPayload) => api.post<Cancha>('/canchas', payload).then((r) => r.data),
  // Guarda cambios en una cancha (el id dice cuál); también se usa para pasarla
  // a mantenimiento sin borrar las reservas ya hechas.
  update: (id: string, payload: Partial<CanchaPayload> & { estado?: Cancha['estado'] }) => api.patch<Cancha>(`/canchas/${id}`, payload).then((r) => r.data),
  // Trae las reservas de una cancha (canchaId dice cuál); si se pasa una fecha,
  // devuelve solo las de ese día para armar la grilla horaria.
  getReservasPorCancha: (canchaId: string, fecha?: string) =>
    api.get<ReservaCancha[]>(`/reservas-cancha/cancha/${canchaId}`, { params: fecha ? { fecha } : {} }).then((r) => r.data),
  // Reserva un turno pasando cancha, usuario, fecha y horario; el precio lo
  // calcula el backend, acá no se manda ningún monto.
  reservar: (payload: { canchaId: string; usuarioId: string; fecha: string; horaInicio: string; horaFin: string }) =>
    api.post<ReservaCancha>('/reservas-cancha', payload).then((r) => r.data),
  // Pregunta cuánto saldría un turno antes de confirmarlo (mismos datos que
  // reservar); sirve para mostrarle el precio a la persona sin crear la reserva.
  cotizar: (payload: { canchaId: string; usuarioId: string; fecha: string; horaInicio: string; horaFin: string }) =>
    api.post<{ precioFinal: number; estrategia: string }>('/reservas-cancha/cotizar', payload).then((r) => r.data),
  // Cancela una reserva existente; el reservaId dice cuál.
  cancelar: (reservaId: string) =>
    api.post<ReservaCancha>(`/reservas-cancha/${reservaId}/cancelar`).then((r) => r.data),
};
