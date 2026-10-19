import { api } from "../../api/axios";

export interface SuscripcionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushApi = {
  // 503 si el servidor no tiene configuradas las claves VAPID.
  clavePublica: () =>
    api
      .get<{ clavePublica: string }>("/notificaciones/push/clave-publica")
      .then((r) => r.data.clavePublica),
  // Idempotente: reasigna el endpoint al usuario de la sesión actual.
  suscribir: (suscripcion: SuscripcionPush) =>
    api
      .post<{ suscrito: boolean }>(
        "/notificaciones/push/suscripcion",
        suscripcion,
      )
      .then((r) => r.data),
  desuscribir: (endpoint: string) =>
    api
      .delete<{ eliminada: boolean }>("/notificaciones/push/suscripcion", {
        data: { endpoint },
      })
      .then((r) => r.data),
};
