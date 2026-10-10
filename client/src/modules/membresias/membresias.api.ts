import { api } from "../../api/axios";
import type { Membresia } from "./membresias.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

export const membresiasApi = {
  // No hay alta ni renovación sin pago: la membresía nace al aprobarse el pago
  // (pagosApi.pagarConPasarela con plan + sedeAltaId).
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
};
