import { api } from "../../api/axios";
import type { Aforo, HistorialAcceso, ResumenAccesos, SesionAbierta } from "./acceso.types";
import type { PaginatedResponse } from "../../shared/types/pagination";
// Funciones para hablar con el backend en todo lo referido al ingreso a las sedes.
export const accesoApi = {
  // Trae cuánta gente hay ahora mismo en una sede; el sedeId dice cuál sede consultar.
  getAforo: (sedeId: string) =>
    api.get<Aforo>(`/acceso/aforo/${sedeId}`).then((res) => res.data),
  // Le pide al backend un código QR nuevito para un usuario (el usuarioId dice
  // para quién); dura 60 segundos y por eso se regenera solo. Viene con
  // el código corto de 6 dígitos, que vence en el mismo momento.
  generarQr: (usuarioId: string) =>
    api
      .get<{ qrToken: string; codigoCorto: string; expiraEn: number }>(`/acceso/qr/${usuarioId}`)
      .then((res) => res.data),
  // Valida el QR escaneado en la puerta y registra el ingreso; lleva el código
  // y la sede donde se está validando.
  validarIngreso: (payload: { qrToken: string; sedeId: string }) =>
    api.post("/acceso/validar", payload).then((res) => res.data),
  // Valida el ingreso con el código corto de 6 dígitos (un solo uso);
  // misma seguridad que el QR, más práctico para dictar a mano.
  validarCodigo: (payload: { codigo: string; sedeId: string }) =>
    api.post("/acceso/validar-codigo", payload).then((res) => res.data),
  // Registra que una persona salió (el usuarioId dice quién), para liberar su lugar en el aforo.
  registrarEgreso: (payload: { usuarioId: string }) =>
    api.post("/acceso/egreso", payload).then((res) => res.data),
  // Trae quiénes están DENTRO de una sede ahora mismo (sesión abierta),
  // para el egreso directo por fila sin pedir identificadores a mano.
  // Paginado: una sede concurrida puede tener cientos de personas adentro.
  listarDentro: (sedeId: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<SesionAbierta>>(`/acceso/dentro/${sedeId}`, { params: { page, limit } }).then((res) => res.data),
  // Trae el historial de ingresos/egresos de un usuario (el usuarioId dice
  // de quién); ownership: solo propio o staff. Viene paginado.
  getHistorial: (usuarioId: string, page = 1, limit = 5) =>
    api.get<PaginatedResponse<HistorialAcceso>>(`/acceso/historial/${usuarioId}`, { params: { page, limit } }).then((res) => res.data),
  // Resumen de accesos de todas las sedes activas (solo Gerente, solo lectura).
  getResumenAccesos: () =>
    api.get<ResumenAccesos>("/acceso/resumen").then((res) => res.data),
};
