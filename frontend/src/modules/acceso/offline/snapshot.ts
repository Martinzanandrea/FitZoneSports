// Snapshot de acceso: lo que el terminal baja para validar QR sin conexión.
import { accesoApi } from '../acceso.api';
import {
  guardarClavePublica,
  guardarSnapshot,
  guardarUltimaSincronizacion,
  leerSnapshot,
  type SnapshotAcceso,
} from './almacenOffline';

// El snapshot vale 24 h desde que el servidor lo generó.
export const VIGENCIA_SNAPSHOT_MS = 24 * 60 * 60 * 1000;
const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';

export type EstadoSocioOffline = 'VIGENTE' | 'NO_VIGENTE' | 'DESCONOCIDO';

export interface SocioEnSnapshot {
  estado: EstadoSocioOffline;
  nombre: string | null;
  apellido: string | null;
}

// Fecha de calendario (YYYY-MM-DD) en Argentina para un instante dado: las
// fechas de membresía se comparan como texto, nunca por el huso del dispositivo.
export function fechaArgentina(ahora: number): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ahora));
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

// Trae la clave pública y el snapshot, los guarda y registra la fecha.
export async function descargarSnapshot(sedeId: string): Promise<SnapshotAcceso> {
  const [clave, snapshot] = await Promise.all([accesoApi.getClavePublica(), accesoApi.getSnapshot(sedeId)]);
  await guardarClavePublica(clave);
  await guardarSnapshot(snapshot);
  await guardarUltimaSincronizacion(new Date().toISOString());
  return snapshot;
}

export function esSnapshotVigente(snapshot: SnapshotAcceso | null, ahora: number = Date.now()): boolean {
  if (!snapshot) return false;
  const generado = Date.parse(snapshot.generadoEn);
  // Un generadoEn ilegible no se considera vigente; uno "del futuro" (reloj
  // atrasado) tampoco debe dar vigencia eterna.
  return Number.isFinite(generado) && ahora - generado < VIGENCIA_SNAPSHOT_MS;
}

export async function snapshotVigente(sedeId: string, ahora: number = Date.now()): Promise<boolean> {
  return esSnapshotVigente(await leerSnapshot(sedeId), ahora);
}

// desde <= hoy < hasta (hasta es exclusivo, igual que fecha_fin en el servidor).
export function buscarSocioEnSnapshot(
  snapshot: SnapshotAcceso,
  usuarioId: string,
  ahora: number = Date.now(),
): SocioEnSnapshot {
  const socio = snapshot.socios.find((s) => s.id === usuarioId);
  if (!socio) return { estado: 'DESCONOCIDO', nombre: null, apellido: null };
  const hoy = fechaArgentina(ahora);
  const vigente = socio.desde <= hoy && hoy < socio.hasta;
  return { estado: vigente ? 'VIGENTE' : 'NO_VIGENTE', nombre: socio.nombre, apellido: socio.apellido };
}

// ¿Ya figura dentro de alguna sede? (sesión abierta, según el snapshot y los ingresos offline)
export function estaDentro(snapshot: SnapshotAcceso, usuarioId: string): boolean {
  return snapshot.dentro.includes(usuarioId);
}

export function aforoDisponible(snapshot: SnapshotAcceso): number {
  return Math.max(0, snapshot.aforo.maximo - snapshot.aforo.actual);
}

// Copia del snapshot con un ingreso más: el socio pasa a "dentro" y el aforo sube.
export function conIngresoLocal(snapshot: SnapshotAcceso, usuarioId: string): SnapshotAcceso {
  return {
    ...snapshot,
    dentro: snapshot.dentro.includes(usuarioId) ? snapshot.dentro : [...snapshot.dentro, usuarioId],
    aforo: { ...snapshot.aforo, actual: snapshot.aforo.actual + 1 },
  };
}
