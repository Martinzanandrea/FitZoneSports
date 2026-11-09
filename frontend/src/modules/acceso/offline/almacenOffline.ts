// Almacén offline en IndexedDB (sin librerías) para el control de acceso sin
// conexión: snapshot de la sede, cola de ingresos por sincronizar y metadatos.
import type { ClavePublica } from './verificarQr';

// GET /acceso/snapshot/:sedeId
export interface SnapshotAcceso {
  sedeId: string;
  generadoEn: string;
  venceEn: string;
  clave: ClavePublica;
  aforo: { actual: number; maximo: number };
  dentro: string[];
  socios: Array<{ id: string; nombre: string; apellido: string; desde: string; hasta: string }>;
}

// Un ingreso leído sin conexión, pendiente de POST /acceso/sincronizar.
export interface EventoOffline {
  clientEventId: string;
  sedeId: string;
  qrToken: string;
  ocurridoEn: string; // ISO
}

export type CodigoErrorAlmacen = 'NO_DISPONIBLE' | 'ERROR_ALMACEN';

export class AlmacenOfflineError extends Error {
  codigo: CodigoErrorAlmacen;
  constructor(codigo: CodigoErrorAlmacen, mensaje: string) {
    super(mensaje);
    this.name = 'AlmacenOfflineError';
    this.codigo = codigo;
  }
}

const NOMBRE_DB = 'fitzone-acceso-offline';
const VERSION_DB = 1;
const STORE_SNAPSHOT = 'snapshot';
const STORE_COLA = 'cola';
const STORE_META = 'meta';
const INDICE_OCURRIDO = 'ocurridoEn';
const META_CLAVE_PUBLICA = 'clavePublica';
const META_ULTIMA_SINCRONIZACION = 'ultimaSincronizacion';

let conexion: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (conexion) return conexion;
  const abierta = new Promise<IDBDatabase>((resolver, rechazar) => {
    if (typeof indexedDB === 'undefined') {
      rechazar(
        new AlmacenOfflineError('NO_DISPONIBLE', 'Este navegador no permite guardar datos sin conexión (IndexedDB no disponible)'),
      );
      return;
    }
    const pedido = indexedDB.open(NOMBRE_DB, VERSION_DB);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      db.createObjectStore(STORE_SNAPSHOT, { keyPath: 'sedeId' });
      const cola = db.createObjectStore(STORE_COLA, { keyPath: 'clientEventId' });
      cola.createIndex(INDICE_OCURRIDO, 'ocurridoEn');
      db.createObjectStore(STORE_META);
    };
    pedido.onsuccess = () => {
      const db = pedido.result;
      // Otra pestaña actualiza o borra la base: se suelta para no bloquearla.
      db.onversionchange = () => {
        db.close();
        conexion = null;
      };
      resolver(db);
    };
    pedido.onerror = () => rechazar(new AlmacenOfflineError('ERROR_ALMACEN', 'No se pudo abrir el almacenamiento sin conexión'));
    pedido.onblocked = () =>
      rechazar(new AlmacenOfflineError('ERROR_ALMACEN', 'El almacenamiento sin conexión está bloqueado por otra pestaña'));
  });
  conexion = abierta;
  // Un fallo al abrir no debe quedar cacheado.
  abierta.catch(() => {
    if (conexion === abierta) conexion = null;
  });
  return abierta;
}

// Corre `operar` dentro de una transacción y resuelve al confirmarla.
async function transaccion<T>(
  stores: string[],
  modo: IDBTransactionMode,
  operar: (tx: IDBTransaction) => IDBRequest<T> | null,
): Promise<T | undefined> {
  const db = await abrir();
  return new Promise<T | undefined>((resolver, rechazar) => {
    const fallo = () => rechazar(new AlmacenOfflineError('ERROR_ALMACEN', 'Falló una operación del almacenamiento sin conexión'));
    try {
      let resultado: T | undefined;
      const tx = db.transaction(stores, modo);
      const pedido = operar(tx);
      if (pedido) pedido.onsuccess = () => (resultado = pedido.result);
      tx.oncomplete = () => resolver(resultado);
      tx.onerror = fallo;
      tx.onabort = fallo;
    } catch {
      fallo();
    }
  });
}

export async function guardarSnapshot(snapshot: SnapshotAcceso): Promise<void> {
  await transaccion([STORE_SNAPSHOT], 'readwrite', (tx) => tx.objectStore(STORE_SNAPSHOT).put(snapshot));
}

export async function leerSnapshot(sedeId: string): Promise<SnapshotAcceso | null> {
  const r = await transaccion<SnapshotAcceso | undefined>([STORE_SNAPSHOT], 'readonly', (tx) =>
    tx.objectStore(STORE_SNAPSHOT).get(sedeId),
  );
  return r ?? null;
}

export async function guardarClavePublica(clave: ClavePublica): Promise<void> {
  await transaccion([STORE_META], 'readwrite', (tx) => tx.objectStore(STORE_META).put(clave, META_CLAVE_PUBLICA));
}

export async function leerClavePublica(): Promise<ClavePublica | null> {
  const r = await transaccion<ClavePublica | undefined>([STORE_META], 'readonly', (tx) =>
    tx.objectStore(STORE_META).get(META_CLAVE_PUBLICA),
  );
  return r ?? null;
}

// Fecha (ISO) de la última sincronización exitosa.
export async function guardarUltimaSincronizacion(fechaIso: string): Promise<void> {
  await transaccion([STORE_META], 'readwrite', (tx) => tx.objectStore(STORE_META).put(fechaIso, META_ULTIMA_SINCRONIZACION));
}

export async function leerUltimaSincronizacion(): Promise<string | null> {
  const r = await transaccion<string | undefined>([STORE_META], 'readonly', (tx) =>
    tx.objectStore(STORE_META).get(META_ULTIMA_SINCRONIZACION),
  );
  return r ?? null;
}

export async function encolarEvento(evento: EventoOffline): Promise<void> {
  await transaccion([STORE_COLA], 'readwrite', (tx) => tx.objectStore(STORE_COLA).put(evento));
}

// Ordenada por ocurridoEn (el más viejo primero).
export async function listarCola(): Promise<EventoOffline[]> {
  const r = await transaccion<EventoOffline[]>([STORE_COLA], 'readonly', (tx) =>
    tx.objectStore(STORE_COLA).index(INDICE_OCURRIDO).getAll(),
  );
  return r ?? [];
}

export async function borrarEventos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await transaccion([STORE_COLA], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_COLA);
    for (const id of ids) store.delete(id);
    return null;
  });
}

export async function contarCola(): Promise<number> {
  return (await transaccion<number>([STORE_COLA], 'readonly', (tx) => tx.objectStore(STORE_COLA).count())) ?? 0;
}

// Borra todo (por ejemplo al cerrar sesión: no debe quedar nada del socio).
export async function limpiarTodo(): Promise<void> {
  await transaccion([STORE_SNAPSHOT, STORE_COLA, STORE_META], 'readwrite', (tx) => {
    tx.objectStore(STORE_SNAPSHOT).clear();
    tx.objectStore(STORE_COLA).clear();
    tx.objectStore(STORE_META).clear();
    return null;
  });
}

// Cierra la conexión cacheada (la próxima operación vuelve a abrirla).
export async function cerrarAlmacen(): Promise<void> {
  if (!conexion) return;
  const pendiente = conexion;
  conexion = null;
  (await pendiente.catch(() => null))?.close();
}
