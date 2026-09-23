import { api } from '../../api/axios';
import type { Cancha, ReservaCancha, CanchaPayload } from './canchas.types';
import type { PaginatedResponse } from '../../shared/types/pagination';

export interface CanchaPublica {
  sede: string;
  tipo: string;
  costoHoraBase: string;
}

export const canchasApi = {
  // Catálogo público de canchas activas (sin login): sede, tipo y
  // precio base por hora. Sin disponibilidad ni reservas.
  getAllPublico: () =>
    api.get<CanchaPublica[]>('/canchas/publico').then((r) => r.data),
  // Le pide al backend la lista de canchas (el propio backend ya filtra según el rol).
  // Viene paginada: page arranca en 1 y limit trae 20 por defecto.
  getAll: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Cancha>>('/canchas', { params: { page, limit } }).then((r) => r.data),
  // Da de alta una cancha nueva en una sede — solo para gerentes.
  create: (payload: CanchaPayload) => api.post<Cancha>('/canchas', payload).then((r) => r.data),
  // Guarda cambios en una cancha (el id dice cuál); también se usa para pasarla
  // a mantenimiento sin borrar las reservas ya hechas.
  update: (id: string, payload: Partial<CanchaPayload> & { estado?: Cancha['estado'] }) => api.patch<Cancha>(`/canchas/${id}`, payload).then((r) => r.data),
  // Trae las reservas de una cancha (canchaId dice cuál); si se pasa una fecha,
  // devuelve solo las de ese día para armar la grilla horaria. También viene
  // paginado (un día tiene 15 turnos como máximo, así que una página alcanza).
  getReservasPorCancha: (canchaId: string, fecha?: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<ReservaCancha>>(`/reservas-cancha/cancha/${canchaId}`, { params: { ...(fecha ? { fecha } : {}), page, limit } }).then((r) => r.data),
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

// Agregación compartida: recorre todas las canchas y junta las reservas
// CONFIRMADA del usuario (el usuarioId dice de quién). Cada cancha que
// falla aporta nada, no rompe el resto.
export async function fetchMisReservasCancha(
  usuarioId: string,
): Promise<Array<{ reserva: ReservaCancha; cancha: Cancha }>> {
  const canchasRes = await canchasApi.getAll(1, 100);
  const out: Array<{ reserva: ReservaCancha; cancha: Cancha }> = [];
  await Promise.all(
    canchasRes.data.map(async (c) => {
      try {
        const res = await canchasApi.getReservasPorCancha(c.id, undefined, 1, 100);
        for (const r of res.data) {
          if (r.usuario.id === usuarioId && r.estado === 'CONFIRMADA') {
            out.push({ reserva: r, cancha: c });
          }
        }
      } catch {
        // sin reservas visibles en esta cancha, se ignora
      }
    }),
  );
  return out;
}
