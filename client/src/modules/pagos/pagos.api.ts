import { api } from "../../api/axios";
import type { Pago, PagoPasarelaPayload } from "./pagos.types";

export interface RegistrarEfectivoPayload {
  usuarioId: string;
  membresiaId?: string;
  reservaClaseId?: string;
  reservaCanchaId?: string;
  monto?: number;
}

export const pagosApi = {
  pagarConPasarela: (payload: PagoPasarelaPayload) =>
    api.post<Pago>("/pagos/pasarela", payload).then((res) => res.data),
  getPorUsuario: (usuarioId: string) =>
    api.get<Pago[]>(`/pagos/usuario/${usuarioId}`).then((res) => res.data),
  registrarEfectivo: (payload: RegistrarEfectivoPayload) =>
    api.post<Pago>("/pagos/efectivo", payload).then((res) => res.data),
};
