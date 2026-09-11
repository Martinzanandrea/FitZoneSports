import { api } from "../../api/axios";
import type { Membresia, CreateMembresiaPayload } from "./membresias.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

export const membresiasApi = {
  // Crea la membresía de un socio eligiendo plan y sede de alta; se usa
  // justo después del registro, antes de pagar.
  create: (payload: CreateMembresiaPayload) =>
    api.post<Membresia>("/membresias", payload).then((res) => res.data),
  // Trae las membresías que le corresponde ver al usuario logueado
  // (el backend ya las filtra por sede si es recepcionista).
  // Viene paginado: page arranca en 1 y limit trae 20 por defecto.
  getAll: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Membresia>>("/membresias", { params: { page, limit } }).then((res) => res.data),
  // Busca la membresía vigente de un usuario; el usuarioId dice de quién;
  // puede venir null si no tiene ninguna activa.
  getVigente: (usuarioId: string) =>
    api
      .get<Membresia | null>(`/membresias/vigente/${usuarioId}`)
      .then((res) => res.data),
  // Pasa una membresía a suspendida (el id dice cuál); se usa cuando el pago
  // sale rechazado para que la persona pueda reintentar sin trabarse.
  cancelar: (id: string) => api.patch<Membresia>(`/membresias/${id}/cancelar`).then((res) => res.data),
  // Crea la membresía del período siguiente tomando como inicio el fin de la
  // actual; lleva los mismos datos que crear una nueva.
  renovar: (payload: CreateMembresiaPayload) =>
    api.post<Membresia>('/membresias/renovar', payload).then((res) => res.data),
};
