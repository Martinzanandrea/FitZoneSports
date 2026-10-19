import { useEffect, useRef, useSyncExternalStore } from 'react';

function suscribir(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

// true si el navegador cree tener red. navigator.onLine puede dar falsos
// positivos (hay red local sin internet), por eso los errores de red también
// se manejan en cada pantalla; esto sirve para avisar y para pausar acciones.
export function useEstadoConexion(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  );
}

// Ejecuta `alVolver` cada vez que se recupera la conexión (evento online).
export function useAlVolverConexion(alVolver: () => void): void {
  const ref = useRef(alVolver);
  useEffect(() => {
    ref.current = alVolver;
  });
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, []);
}

export const MENSAJE_SIN_CONEXION = 'Sin conexión a internet';
export const MENSAJE_ERROR_CARGA = 'No se pudo cargar la información';

// Motivo a mostrar cuando una carga falló.
export function motivoDeError(): string {
  return navigator.onLine ? MENSAJE_ERROR_CARGA : MENSAJE_SIN_CONEXION;
}

export const TEXTO_REQUIERE_CONEXION = 'Requiere conexión a internet.';
