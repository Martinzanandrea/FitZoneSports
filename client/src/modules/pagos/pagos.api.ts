import { api } from "../../api/axios";
import type { Pago, PagoPasarelaPayload } from "./pagos.types";

export const pagosApi = {
  pagarConPasarela: (payload: PagoPasarelaPayload) =>
    api.post<Pago>("/pagos/pasarela", payload).then((res) => res.data),
};
