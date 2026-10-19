import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePushEstado } from "../hooks/usePushEstado";
import {
  PushContext,
  type PushCompartido,
} from "../hooks/usePushNotificaciones";

interface Aviso {
  tipo: "ok" | "err";
  texto: string;
}

const DURACION_AVISO_MS = 4500;

// Una sola instancia del estado push por sesión de panel: cualquier cambio se refleja en todas las
// pantallas que lo consumen. Muestra el aviso breve de éxito o error al activar.
export function PushProvider({ children }: { children: ReactNode }) {
  const estado = usePushEstado();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const { activar: activarBase } = estado;

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const activar = useCallback<PushCompartido["activar"]>(
    async (origen) => {
      const r = await activarBase();
      if (r.exito)
        setAviso({
          tipo: "ok",
          texto: "Notificaciones activadas en este dispositivo",
        });
      else if (r.error && origen !== "tarjeta")
        setAviso({ tipo: "err", texto: r.error });
      return r;
    },
    [activarBase],
  );

  return (
    <PushContext.Provider value={{ ...estado, activar }}>
      {children}
      {aviso && (
        <div
          role="status"
          aria-live="polite"
          className={`notice ${aviso.tipo === "ok" ? "notice-ok" : "notice-err"} glass`}
          style={{
            position: "fixed",
            top: "max(12px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "var(--z-toast)",
            width: "min(420px, calc(100vw - 24px))",
            background: "var(--layer)",
          }}
        >
          {aviso.texto}
        </div>
      )}
    </PushContext.Provider>
  );
}
