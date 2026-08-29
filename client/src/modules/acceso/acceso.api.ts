import { api } from "../../api/axios";
import type { Aforo } from "./acceso.types";

export const accesoApi = {
  getAforo: (sedeId: string) =>
    api.get<Aforo>(`/acceso/aforo/${sedeId}`).then((res) => res.data),
  generarQr: (usuarioId: string) =>
    api
      .get<{ qrToken: string; expiraEn: number }>(`/acceso/qr/${usuarioId}`)
      .then((res) => res.data),
  validarIngreso: (payload: { qrToken: string; sedeId: string }) =>
    api.post("/acceso/validar", payload).then((res) => res.data),
  registrarEgreso: (payload: { usuarioId: string }) =>
    api.post("/acceso/egreso", payload).then((res) => res.data),
};
