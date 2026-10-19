import { pushApi, type SuscripcionPush } from "./push.api";

// Funciones sin React sobre la suscripción push de este dispositivo.
// Las usan el hook de la pantalla, el cierre de sesión y el reenvío al iniciar sesión.

export function pushSoportado(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// El service worker solo se registra en producción; sin él no hay suscripción posible.
export async function obtenerSuscripcion(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export function aCuerpoApi(sub: PushSubscription): SuscripcionPush | null {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function base64UrlAUint8Array(
  base64Url: string,
): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const salida = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) salida[i] = binario.charCodeAt(i);
  return salida;
}

// Con permiso ya concedido y una suscripción del navegador, la reenvía (POST idempotente)
// para que quede asociada al usuario actual. Nunca pide permiso ni lanza error.
export async function reenviarSuscripcionExistente(): Promise<void> {
  try {
    if (!pushSoportado() || Notification.permission !== "granted") return;
    const sub = await obtenerSuscripcion();
    const cuerpo = sub && aCuerpoApi(sub);
    if (cuerpo) await pushApi.suscribir(cuerpo);
  } catch {
    /* sin red o sin servicio: se reintenta en la próxima carga */
  }
}

// Al cerrar sesión: baja la suscripción de este dispositivo del backend y del navegador.
// Acotado en tiempo para no demorar el cierre; los errores se ignoran.
export async function desuscribirDispositivo(
  esperaMaxMs = 1500,
): Promise<void> {
  const tarea = (async () => {
    const sub = await obtenerSuscripcion();
    if (!sub) return;
    const { endpoint } = sub;
    await Promise.allSettled([
      pushApi.desuscribir(endpoint),
      sub.unsubscribe(),
    ]);
  })().catch(() => undefined);
  await Promise.race([
    tarea,
    new Promise<void>((r) => setTimeout(r, esperaMaxMs)),
  ]);
}
