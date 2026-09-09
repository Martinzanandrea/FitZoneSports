import { api } from "../../api/axios";
import type { Aforo } from "./acceso.types";
// Funciones para hablar con el backend en todo lo referido al ingreso a las sedes.
export const accesoApi = {
  // Trae cuánta gente hay ahora mismo en una sede; el sedeId dice cuál sede consultar.
  getAforo: (sedeId: string) =>
    api.get<Aforo>(`/acceso/aforo/${sedeId}`).then((res) => res.data),
  // Le pide al backend un código QR nuevito para un usuario (el usuarioId dice
  // para quién); dura 60 segundos y por eso se regenera solo.
  generarQr: (usuarioId: string) =>
    api
      .get<{ qrToken: string; expiraEn: number }>(`/acceso/qr/${usuarioId}`)
      .then((res) => res.data),
  // Valida el QR escaneado en la puerta y registra el ingreso; lleva el código
  // y la sede donde se está validando.
  validarIngreso: (payload: { qrToken: string; sedeId: string }) =>
    api.post("/acceso/validar", payload).then((res) => res.data),
  // Registra que una persona salió (el usuarioId dice quién), para liberar su lugar en el aforo.
  registrarEgreso: (payload: { usuarioId: string }) =>
    api.post("/acceso/egreso", payload).then((res) => res.data),
};
