import { useCallback, useSyncExternalStore } from "react";
import { esModoStandalone, useModoStandalone } from "./useModoStandalone";

// Evento no estándar de Chrome y Edge.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type ModoInstalacion = "prompt" | "ios" | null;

interface Estado {
  evento: BeforeInstallPromptEvent | null;
  instalada: boolean;
}

// El evento puede dispararse antes de que se monte cualquier componente, por eso
// se captura al cargar el módulo y se guarda acá.
let estado: Estado = { evento: null, instalada: false };
const oyentes = new Set<() => void>();

function actualizar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    actualizar({ evento: e as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () =>
    actualizar({ evento: null, instalada: true }),
  );
}

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

// Safari de iPhone y iPad (no existe beforeinstallprompt). Otros navegadores de iOS quedan afuera.
function esSafariIos(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function useInstalacion(): {
  modo: ModoInstalacion;
  instalar: () => Promise<void>;
} {
  const { evento, instalada } = useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
  const standalone = useModoStandalone();

  const instalar = useCallback(async () => {
    const e = estado.evento;
    if (!e) return;
    try {
      await e.prompt();
      await e.userChoice;
    } catch {
      /* el usuario cerró el cuadro o el navegador lo rechazó */
    }
    // El evento solo admite un prompt; si acepta, appinstalled termina de ocultar el botón.
    actualizar({ evento: null });
  }, []);

  let modo: ModoInstalacion = null;
  if (!standalone && !instalada && !esModoStandalone()) {
    if (evento) modo = "prompt";
    else if (esSafariIos()) modo = "ios";
  }
  return { modo, instalar };
}
