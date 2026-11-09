import { useCallback, useEffect, useRef, useState } from 'react';
import { useEstadoConexion } from '../../../shared/hooks/useEstadoConexion';
import { leerUltimaSincronizacion } from './almacenOffline';
import {
  contarPendientes,
  leerResumenUltimaSync,
  sincronizarCola,
  type ResumenSincronizacion,
} from './colaIngresos';
import { descargarSnapshot as descargarSnapshotSede, snapshotVigente as leerSnapshotVigente } from './snapshot';

export const INTERVALO_REINTENTO_MS = 30_000;

export interface ModoOffline {
  sinConexion: boolean;
  pendientes: number;
  ultimaSincronizacion: string | null;
  snapshotVigente: boolean;
  resumenUltimaSync: ResumenSincronizacion | null;
  sincronizando: boolean;
  descargarSnapshot: () => Promise<void>;
  sincronizar: () => Promise<void>;
  // Vuelve a leer el estado local (p. ej. después de encolar un ingreso).
  refrescar: () => Promise<void>;
}

// Estado del modo offline de una sede: conexión, cola pendiente y snapshot.
// Sincroniza solo al volver la conexión y, mientras hay pendientes, cada 30 s.
export function useModoOffline(sedeId: string | null): ModoOffline {
  const sinConexion = !useEstadoConexion();
  const [pendientes, setPendientes] = useState(0);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string | null>(null);
  const [snapshotVigente, setSnapshotVigente] = useState(false);
  const [resumenUltimaSync, setResumenUltimaSync] = useState<ResumenSincronizacion | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const [cuantos, ultima, resumen, vigente] = await Promise.all([
        contarPendientes(),
        leerUltimaSincronizacion(),
        leerResumenUltimaSync(),
        sedeId ? leerSnapshotVigente(sedeId) : Promise.resolve(false),
      ]);
      if (!montado.current) return;
      setPendientes(cuantos);
      setUltimaSincronizacion(ultima);
      setResumenUltimaSync(resumen);
      setSnapshotVigente(vigente);
    } catch {
      // Sin almacenamiento local no hay estado que mostrar: queda en sus valores iniciales.
    }
  }, [sedeId]);

  const sincronizar = useCallback(async () => {
    if (montado.current) setSincronizando(true);
    try {
      await sincronizarCola();
    } finally {
      if (montado.current) setSincronizando(false);
      await refrescar();
    }
  }, [refrescar]);

  const descargarSnapshot = useCallback(async () => {
    if (!sedeId) return;
    await descargarSnapshotSede(sedeId);
    await refrescar();
  }, [sedeId, refrescar]);

  useEffect(() => {
    // Lectura asíncrona del almacén local: el estado se actualiza al resolver.
    void Promise.resolve().then(refrescar);
  }, [refrescar]);

  // Al volver la conexión (y al montar con red y pendientes) sincroniza solo.
  const pendientesRef = useRef(pendientes);
  useEffect(() => {
    pendientesRef.current = pendientes;
  });
  useEffect(() => {
    if (sinConexion) return;
    void sincronizar().catch(() => undefined);
  }, [sinConexion, sincronizar]);

  // Mientras haya pendientes y conexión, reintenta cada 30 s.
  useEffect(() => {
    if (sinConexion || pendientes === 0) return;
    const id = setInterval(() => {
      if (pendientesRef.current > 0) void sincronizar().catch(() => undefined);
    }, INTERVALO_REINTENTO_MS);
    return () => clearInterval(id);
  }, [sinConexion, pendientes, sincronizar]);

  return {
    sinConexion,
    pendientes,
    ultimaSincronizacion,
    snapshotVigente,
    resumenUltimaSync,
    sincronizando,
    descargarSnapshot,
    sincronizar,
    refrescar,
  };
}
