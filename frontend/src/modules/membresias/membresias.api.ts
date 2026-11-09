import { api } from "../../api/axios";
import type { EstadoSocio, Membresia } from "./membresias.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

export const membresiasApi = {
  // No hay alta ni renovación sin pago: la membresía nace al aprobarse el pago
  // (pagosApi.pagarConPasarela con plan + sedeAltaId).
  // Trae las membresías que le corresponde ver al usuario logueado
  // (el backend ya las filtra por sede si es gerente de sede).
  // Viene paginado: page arranca en 1 y limit trae 20 por defecto.
  getAll: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Membresia>>("/membresias", { params: { page, limit } }).then((res) => res.data),
  // Estado de membresía de un usuario: la vigente (o la última terminada o
  // suspendida) más la próxima programada, si existe. Puede venir null.
  // Un null del backend llega como 200 con cuerpo vacío (axios lo da como ""):
  // se normaliza a null. Un fallo de red o del servidor RECHAZA la promesa; quien
  // llama no debe convertir ese rechazo en null, porque null significa "sin membresía".
  getVigente: (usuarioId: string) =>
    api
      .get<EstadoSocio | null>(`/membresias/vigente/${usuarioId}`)
      .then((res) => res.data || null),
};
