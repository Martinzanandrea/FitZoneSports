import { api } from '../../api/axios';
import type { Cancha, ReservaCancha, CanchaPayload, TipoCanchaCatalogo } from './canchas.types';
import type { PaginatedResponse } from '../../shared/types/pagination';

export interface CanchaPublica {
  sede: string;
  tipo: { nombre: string; imagenUrl: string | null };
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
  // Suma de pagos aprobados de canchas del mes actual (recepcionista ve
  // solo su sede, gerente todas). Calculado en el backend, no estimado acá.
  getIngresosMes: () =>
    api.get<{ total: number }>('/canchas/ingresos-mes').then((r) => r.data),
};

// Catálogo de tipos de cancha (tabla tipos_cancha en el backend).
// Se manda FormData porque crear/editar puede incluir la foto.
export const tiposCanchaApi = {
  // Tipos activos (sin login): para la landing y selectores públicos.
  listar: () =>
    api.get<TipoCanchaCatalogo[]>('/tipos-cancha').then((r) => r.data),
  // Todos incluidos inactivos — solo Gerente (gestión del catálogo).
  listarTodos: () =>
    api.get<TipoCanchaCatalogo[]>('/tipos-cancha/todos').then((r) => r.data),
  // Alta con foto opcional — solo Gerente.
  crear: (nombre: string, foto?: File | null) => {
    const data = new FormData();
    data.append('nombre', nombre);
    if (foto) data.append('foto', foto);
    return api.post<TipoCanchaCatalogo>('/tipos-cancha', data).then((r) => r.data);
  },
  // Cambia nombre y/o reemplaza la foto — solo Gerente.
  editar: (id: string, nombre?: string, foto?: File | null) => {
    const data = new FormData();
    if (nombre !== undefined) data.append('nombre', nombre);
    if (foto) data.append('foto', foto);
    return api.patch<TipoCanchaCatalogo>(`/tipos-cancha/${id}`, data).then((r) => r.data);
  },
  // Activa o desactiva (nunca se borra de verdad por la FK de canchas) — solo Gerente.
  cambiarEstado: (id: string, activo: boolean) =>
    api.patch<TipoCanchaCatalogo>(`/tipos-cancha/${id}/estado`, { activo }).then((r) => r.data),
  // Borrado real, solo si ninguna cancha usa el tipo — solo Gerente.
  // Si hay canchas asociadas el backend responde 400 con el conteo.
  eliminar: (id: string) =>
    api.delete<void>(`/tipos-cancha/${id}`).then((r) => r.data),
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
