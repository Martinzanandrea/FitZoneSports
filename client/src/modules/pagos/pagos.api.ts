import { api } from "../../api/axios";
import type { Pago, PagoPasarelaPayload } from "./pagos.types";
import type { Usuario } from "../usuarios/usuarios.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

// Cliente de la sede para cobrar: solo lo necesario para identificarlo.
export type ClienteCobro = Pick<Usuario, "id" | "nombre" | "apellido" | "dni" | "tipoActor">;

export interface ReservaCanchaCobro {
  id: string;
  estado: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precioFinal: string;
  cancha: { nombre: string; sede: { id: string; nombre: string } };
}

export interface RegistrarEfectivoPayload {
  usuarioId: string;
  membresiaId?: string;
  reservaCanchaId?: string;
  /** Plan a cobrar: el precio lo calcula el backend, nunca el cliente. */
  plan?: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  monto?: number;
}

export const pagosApi = {
  // Clientes (socios y externos activos) de la sede de quien cobra, paginados
  // en el servidor (limit máx. 20) y filtrables por nombre, apellido o DNI.
  getClientesEfectivo: (params: { page: number; limit?: number; q?: string }) =>
    api
      .get<PaginatedResponse<ClienteCobro>>("/pagos/efectivo/clientes", {
        params: { page: params.page, limit: params.limit ?? 20, q: params.q || undefined },
      })
      .then((res) => res.data),
  // Reservas de cancha pendientes de cobro de UN cliente, en la sede de quien cobra.
  getReservasCanchaEfectivo: (usuarioId: string) =>
    api
      .get<ReservaCanchaCobro[]>("/pagos/efectivo/reservas-cancha", { params: { usuarioId } })
      .then((res) => res.data),
  // Cobra con la pasarela simulada; el monto real lo calcula el backend,
  // lo que se manda es a qué corresponde el pago y con qué método.
  pagarConPasarela: (payload: PagoPasarelaPayload) =>
    api.post<Pago>("/pagos/pasarela", payload).then((res) => res.data),
  // Trae el historial de pagos de una persona; el usuarioId dice de quién
  // (cada uno solo puede ver el propio, salvo el staff).
  // Viene paginado: page arranca en 1 y limit trae 20 por defecto.
  getPorUsuario: (usuarioId: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<Pago>>(`/pagos/usuario/${usuarioId}`, { params: { page, limit } }).then((res) => res.data),
  // Registra un cobro en efectivo hecho en el mostrador — solo para
  // recepcionistas y gerentes; se pasa una sola de las dos referencias
  // (membresía o reserva de cancha).
  registrarEfectivo: (payload: RegistrarEfectivoPayload) =>
    api.post<Pago>("/pagos/efectivo", payload).then((res) => res.data),
};
