import { createContext, useContext } from "react";
import type { EstadoPush, ResultadoActivacion } from "./usePushEstado";

export type { PermisoPush } from "./usePushEstado";

export interface PushCompartido extends Omit<EstadoPush, "activar"> {
  // origen 'tarjeta': la tarjeta de Configuración ya muestra el error en su lugar, no se repite en el aviso.
  activar: (origen?: "tarjeta") => Promise<ResultadoActivacion>;
}

export const PushContext = createContext<PushCompartido | null>(null);

// Estado push compartido por la campanita, la invitación del inicio y la tarjeta de Configuración.
export function usePushNotificaciones(): PushCompartido {
  const ctx = useContext(PushContext);
  if (!ctx)
    throw new Error("usePushNotificaciones debe usarse dentro de PushProvider");
  return ctx;
}
