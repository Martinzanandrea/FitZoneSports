import { useCallback, useEffect, useState } from "react";
import { MENSAJE_SIN_CONEXION } from "../../../shared/hooks/useEstadoConexion";
import { pushApi } from "../push.api";
import {
  aCuerpoApi,
  base64UrlAUint8Array,
  obtenerSuscripcion,
  pushSoportado,
} from "../push.cliente";

export type PermisoPush = NotificationPermission | "no-soportado";

export interface ResultadoActivacion {
  exito: boolean;
  error: string | null;
}

export interface EstadoPush {
  soportado: boolean;
  permiso: PermisoPush;
  suscrito: boolean;
  // iPhone/iPad en el navegador: iOS solo admite push en la app agregada a la pantalla de inicio.
  requiereInstalar: boolean;
  verificando: boolean;
  trabajando: boolean;
  error: string | null;
  activar: () => Promise<ResultadoActivacion>;
  desactivar: () => Promise<void>;
}

function esIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ se identifica como Mac con pantalla táctil.
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function esAppInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function mensajeDeError(err: unknown): string {
  if (!navigator.onLine) return MENSAJE_SIN_CONEXION;
  const e = err as {
    response?: { status?: number };
    request?: unknown;
    name?: string;
  };
  if (e.response?.status === 503)
    return "Las notificaciones no están configuradas en el servidor. Intentá más tarde.";
  if (e.response?.status === 401)
    return "Tu sesión venció. Iniciá sesión de nuevo.";
  if (e.response) return "No se pudo completar la operación. Intentá de nuevo.";
  if (e.request)
    return "No se pudo conectar con el servidor. Revisá tu conexión.";
  if (e.name === "NotAllowedError")
    return "El navegador no permitió activar las notificaciones.";
  return "No se pudo activar las notificaciones en este dispositivo.";
}

// Estado push de este dispositivo. Lo instancia una sola vez PushProvider; las pantallas lo
// consumen con usePushNotificaciones para mantenerse sincronizadas.
export function usePushEstado(): EstadoPush {
  const soportado = pushSoportado();
  const [permiso, setPermiso] = useState<PermisoPush>(
    soportado ? Notification.permission : "no-soportado",
  );
  const [suscrito, setSuscrito] = useState(false);
  const [verificando, setVerificando] = useState(soportado);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiereInstalar = esIos() && !esAppInstalada();

  useEffect(() => {
    if (!soportado) return;
    let activo = true;
    obtenerSuscripcion()
      .then((sub) => activo && setSuscrito(!!sub))
      .catch(() => undefined)
      .finally(() => activo && setVerificando(false));
    return () => {
      activo = false;
    };
  }, [soportado]);

  // Llamar solo desde un clic: es lo único que dispara el pedido de permiso.
  const activar = useCallback(async (): Promise<ResultadoActivacion> => {
    if (!soportado) return { exito: false, error: null };
    setTrabajando(true);
    setError(null);
    const fallar = (mensaje: string): ResultadoActivacion => {
      setError(mensaje);
      return { exito: false, error: mensaje };
    };
    try {
      const resultado = await Notification.requestPermission();
      setPermiso(resultado);
      if (resultado !== "granted") {
        return fallar(
          resultado === "denied"
            ? "Las notificaciones están bloqueadas para este sitio."
            : "No se concedió el permiso de notificaciones.",
        );
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        return fallar("Las notificaciones no están disponibles en esta versión de la aplicación.");
      }
      await navigator.serviceWorker.ready;
      const clave = await pushApi.clavePublica();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlAUint8Array(clave),
        }));
      const cuerpo = aCuerpoApi(sub);
      if (!cuerpo) {
        await sub.unsubscribe().catch(() => undefined);
        return fallar("El navegador devolvió una suscripción incompleta. Intentá de nuevo.");
      }
      await pushApi.suscribir(cuerpo);
      setSuscrito(true);
      return { exito: true, error: null };
    } catch (err) {
      return fallar(mensajeDeError(err));
    } finally {
      setTrabajando(false);
    }
  }, [soportado]);

  const desactivar = useCallback(async () => {
    setTrabajando(true);
    setError(null);
    try {
      const sub = await obtenerSuscripcion();
      if (sub) {
        // Primero el backend: si falla (sin red), la suscripción local se conserva y se puede reintentar.
        await pushApi.desuscribir(sub.endpoint);
        await sub.unsubscribe();
      }
      setSuscrito(false);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setTrabajando(false);
    }
  }, []);

  return {
    soportado,
    permiso,
    suscrito,
    requiereInstalar,
    verificando,
    trabajando,
    error,
    activar,
    desactivar,
  };
}
