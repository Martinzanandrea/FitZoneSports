import { useSyncExternalStore } from "react";

const CONSULTA = "(display-mode: standalone)";

// true si la app corre instalada: display-mode standalone (Android, PC) o
// navigator.standalone (iOS, donde matchMedia no siempre lo refleja).
export function esModoStandalone(): boolean {
  try {
    return (
      window.matchMedia(CONSULTA).matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function suscribir(cb: () => void) {
  try {
    const mq = window.matchMedia(CONSULTA);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  } catch {
    return () => undefined;
  }
}

export function useModoStandalone(): boolean {
  return useSyncExternalStore(suscribir, esModoStandalone, () => false);
}

// Coincidencia de una media query (p. ej. pantallas de celular y tablet chica).
export function useMediaQuery(consulta: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      try {
        const mq = window.matchMedia(consulta);
        mq.addEventListener("change", cb);
        return () => mq.removeEventListener("change", cb);
      } catch {
        return () => undefined;
      }
    },
    () => {
      try {
        return window.matchMedia(consulta).matches;
      } catch {
        return false;
      }
    },
    () => false,
  );
}
