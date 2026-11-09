// Cola de ingresos offline: valida el QR contra el snapshot local, encola el
// ingreso y lo sincroniza con el servidor cuando hay conexión.
import { accesoApi } from '../acceso.api';
import type { EstadoSincronizacion } from '../acceso.types';
import {
  borrarEventos,
  encolarEvento,
  guardarMeta,
  guardarSnapshot,
  guardarUltimaSincronizacion,
  leerClavePublica,
  leerMeta,
  leerSnapshot,
  listarCola,
  type EventoOffline,
} from './almacenOffline';
import { aforoDisponible, buscarSocioEnSnapshot, conIngresoLocal, esSnapshotVigente, estaDentro } from './snapshot';
import { verifyQrOffline } from './verificarQr';

export const TAMANO_LOTE = 100;
const META_RESUMEN = 'resumenUltimaSync';
const META_FALLIDOS = 'eventosFallidos';

export type MotivoRechazoOffline =
  | 'SIN_SNAPSHOT'
  | 'SNAPSHOT_VENCIDO'
  | 'QR_INVALIDO'
  | 'QR_VENCIDO'
  | 'SOCIO_DESCONOCIDO'
  | 'SOCIO_NO_VIGENTE'
  | 'YA_DENTRO'
  | 'AFORO_COMPLETO';

export type ResultadoIngresoOffline =
  | { permitido: true; nombre: string; apellido: string; mensaje: string }
  | { permitido: false; motivo: MotivoRechazoOffline; mensaje: string; nombre?: string; apellido?: string };

const MENSAJES: Record<MotivoRechazoOffline, string> = {
  SIN_SNAPSHOT: 'No hay datos descargados de esta sede. Descargalos con conexión antes de operar sin red.',
  SNAPSHOT_VENCIDO: 'Los datos descargados tienen más de 24 horas. Conectate para actualizarlos.',
  QR_INVALIDO: 'El código QR no es válido.',
  QR_VENCIDO: 'El código QR venció. Pedile al socio que lo actualice.',
  SOCIO_DESCONOCIDO: 'El socio no figura en los datos descargados de la red.',
  SOCIO_NO_VIGENTE: 'La membresía del socio no está vigente.',
  YA_DENTRO: 'El socio ya figura dentro de una sede.',
  AFORO_COMPLETO: 'La sede alcanzó su aforo máximo.',
};

const rechazo = (
  motivo: MotivoRechazoOffline,
  socio?: { nombre: string | null; apellido: string | null },
): ResultadoIngresoOffline => ({
  permitido: false,
  motivo,
  mensaje: MENSAJES[motivo],
  ...(socio?.nombre ? { nombre: socio.nombre, apellido: socio.apellido ?? '' } : {}),
});

// Las validaciones leen y reescriben el snapshot: se serializan para que dos
// lecturas seguidas del mismo QR no pasen las dos.
let candadoValidacion: Promise<unknown> = Promise.resolve();

export function validarIngresoOffline(
  sedeId: string,
  qrToken: string,
  ahora: number = Date.now(),
): Promise<ResultadoIngresoOffline> {
  const turno = candadoValidacion.then(() => validar(sedeId, qrToken, ahora));
  candadoValidacion = turno.catch(() => undefined);
  return turno;
}

async function validar(sedeId: string, qrToken: string, ahora: number): Promise<ResultadoIngresoOffline> {
  const snapshot = await leerSnapshot(sedeId);
  if (!snapshot) return rechazo('SIN_SNAPSHOT');
  if (!esSnapshotVigente(snapshot, ahora)) return rechazo('SNAPSHOT_VENCIDO');

  const clave = (await leerClavePublica()) ?? snapshot.clave;
  const qr = await verifyQrOffline(qrToken, clave, ahora);
  if (!qr.ok) return rechazo(qr.motivo === 'VENCIDO' ? 'QR_VENCIDO' : 'QR_INVALIDO');

  const socio = buscarSocioEnSnapshot(snapshot, qr.usuarioId, ahora);
  if (socio.estado === 'DESCONOCIDO') return rechazo('SOCIO_DESCONOCIDO');
  if (socio.estado === 'NO_VIGENTE') return rechazo('SOCIO_NO_VIGENTE', socio);
  if (estaDentro(snapshot, qr.usuarioId)) return rechazo('YA_DENTRO', socio);
  if (aforoDisponible(snapshot) <= 0) return rechazo('AFORO_COMPLETO', socio);

  await encolarEvento({
    clientEventId: crypto.randomUUID(),
    sedeId,
    qrToken,
    ocurridoEn: new Date(ahora).toISOString(),
  });
  await guardarSnapshot(conIngresoLocal(snapshot, qr.usuarioId));

  const nombre = socio.nombre ?? '';
  const apellido = socio.apellido ?? '';
  return { permitido: true, nombre, apellido, mensaje: `Ingreso permitido: ${nombre} ${apellido}`.trim() };
}

// ---------------------------------------------------------------- sincronización

export interface DetalleSincronizacion {
  clientEventId: string;
  estado: EstadoSincronizacion;
  codigo: string;
}

export type CausaInterrupcion = 'RED' | 'SESION' | 'SERVIDOR';

export interface ResumenSincronizacion {
  fecha: string;
  creados: number;
  observados: number;
  conflictos: number;
  rechazados: number;
  // Solo los que no salieron CREADO, para mostrarlos en pantalla.
  detalle: DetalleSincronizacion[];
  // Eventos de lotes que el servidor rechazó con 400: no se reintentan solos.
  fallidos: string[];
  // Si el envío se cortó (no se borró nada del lote en curso ni de los siguientes).
  interrumpida?: CausaInterrupcion;
}

const estadoHttp = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } } | null)?.response?.status;

function causaDe(err: unknown): CausaInterrupcion {
  const status = estadoHttp(err);
  if (status === 401 || status === 403) return 'SESION';
  if (status !== undefined && status >= 500) return 'SERVIDOR';
  return 'RED';
}

async function leerFallidos(): Promise<Set<string>> {
  return new Set((await leerMeta<string[]>(META_FALLIDOS)) ?? []);
}

// Cuántos eventos esperan sincronizarse (sin contar los que el servidor rechazó por 400).
export async function contarPendientes(): Promise<number> {
  const [cola, fallidos] = await Promise.all([listarCola(), leerFallidos()]);
  return cola.filter((e) => !fallidos.has(e.clientEventId)).length;
}

export function leerResumenUltimaSync(): Promise<ResumenSincronizacion | null> {
  return leerMeta<ResumenSincronizacion>(META_RESUMEN);
}

function porLotes(eventos: EventoOffline[]): Array<{ sedeId: string; eventos: EventoOffline[] }> {
  // Agrupa por sede conservando el orden de la cola (ya viene por ocurridoEn).
  const porSede = new Map<string, EventoOffline[]>();
  for (const e of eventos) porSede.set(e.sedeId, [...(porSede.get(e.sedeId) ?? []), e]);
  const lotes: Array<{ sedeId: string; eventos: EventoOffline[] }> = [];
  for (const [sedeId, lista] of porSede) {
    for (let i = 0; i < lista.length; i += TAMANO_LOTE) lotes.push({ sedeId, eventos: lista.slice(i, i + TAMANO_LOTE) });
  }
  return lotes;
}

let enCurso: Promise<ResumenSincronizacion | null> | null = null;

// Envía la cola. No corre dos veces en paralelo: una segunda llamada mientras
// hay una en curso comparte su resultado. Devuelve null si no había nada que enviar.
export function sincronizarCola(): Promise<ResumenSincronizacion | null> {
  if (!enCurso) {
    enCurso = ejecutarSincronizacion().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function ejecutarSincronizacion(): Promise<ResumenSincronizacion | null> {
  const fallidosPrevios = await leerFallidos();
  const cola = (await listarCola()).filter((e) => !fallidosPrevios.has(e.clientEventId));
  if (cola.length === 0) return null;

  const resumen: ResumenSincronizacion = {
    fecha: new Date().toISOString(),
    creados: 0,
    observados: 0,
    conflictos: 0,
    rechazados: 0,
    detalle: [],
    fallidos: [],
  };
  const fallidos = new Set(fallidosPrevios);
  let huboRespuesta = false;

  for (const lote of porLotes(cola)) {
    try {
      const { resultados } = await accesoApi.sincronizar({
        sedeId: lote.sedeId,
        eventos: lote.eventos.map(({ clientEventId, qrToken, ocurridoEn }) => ({ clientEventId, qrToken, ocurridoEn })),
      });
      huboRespuesta = true;
      const enviados = new Set(lote.eventos.map((e) => e.clientEventId));
      // Se borra solo lo que el servidor devolvió (cualquier estado: ya lo registró).
      const procesados = resultados.filter((r) => enviados.has(r.clientEventId));
      await borrarEventos(procesados.map((r) => r.clientEventId));
      for (const r of procesados) {
        if (r.estado === 'CREADO') resumen.creados++;
        else {
          if (r.estado === 'OBSERVADO') resumen.observados++;
          else if (r.estado === 'CONFLICTO') resumen.conflictos++;
          else resumen.rechazados++;
          resumen.detalle.push({ clientEventId: r.clientEventId, estado: r.estado, codigo: r.codigo });
        }
      }
    } catch (err) {
      if (estadoHttp(err) === 400) {
        // El cuerpo no valida: reintentarlo igual fallaría siempre.
        for (const e of lote.eventos) {
          fallidos.add(e.clientEventId);
          resumen.fallidos.push(e.clientEventId);
        }
        continue;
      }
      // Red, sesión o servidor: nada de este lote se borra y se corta el envío.
      resumen.interrumpida = causaDe(err);
      break;
    }
  }

  if (resumen.fallidos.length > 0) await guardarMeta(META_FALLIDOS, [...fallidos]);
  if (huboRespuesta || resumen.fallidos.length > 0) await guardarMeta(META_RESUMEN, resumen);
  if (huboRespuesta && !resumen.interrumpida) await guardarUltimaSincronizacion(resumen.fecha);
  return resumen;
}
