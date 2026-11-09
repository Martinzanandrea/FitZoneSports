import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AlmacenOfflineError,
  borrarEventos,
  cerrarAlmacen,
  contarCola,
  encolarEvento,
  guardarClavePublica,
  guardarSnapshot,
  guardarUltimaSincronizacion,
  leerClavePublica,
  leerSnapshot,
  leerUltimaSincronizacion,
  limpiarTodo,
  listarCola,
  type EventoOffline,
  type SnapshotAcceso,
} from './almacenOffline';

const clave = { kid: 'a1b2c3d4', alg: 'ES256' as const, jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } };

const snapshot = (sedeId: string): SnapshotAcceso => ({
  sedeId,
  generadoEn: '2026-10-09T18:00:00.000Z',
  venceEn: '2026-10-10T18:00:00.000Z',
  clave,
  aforo: { actual: 3, maximo: 50 },
  dentro: ['u9'],
  socios: [{ id: 'u1', nombre: 'Ana', apellido: 'Paz', desde: '2026-10-01', hasta: '2026-11-01' }],
});

const evento = (id: string, ocurridoEn: string): EventoOffline => ({
  clientEventId: id,
  sedeId: 'sA',
  qrToken: `token-${id}`,
  ocurridoEn,
});

beforeEach(async () => {
  await limpiarTodo();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await cerrarAlmacen();
});

describe('almacenOffline', () => {
  it('guarda y lee el snapshot por sede', async () => {
    await guardarSnapshot(snapshot('sA'));
    await guardarSnapshot(snapshot('sB'));
    expect(await leerSnapshot('sA')).toEqual(snapshot('sA'));
    expect((await leerSnapshot('sB'))?.sedeId).toBe('sB');
  });

  it('leer un snapshot inexistente da null', async () => {
    expect(await leerSnapshot('nadie')).toBeNull();
  });

  it('guardar de nuevo el snapshot de una sede lo reemplaza', async () => {
    await guardarSnapshot(snapshot('sA'));
    await guardarSnapshot({ ...snapshot('sA'), aforo: { actual: 9, maximo: 50 } });
    expect((await leerSnapshot('sA'))?.aforo.actual).toBe(9);
  });

  it('guarda y lee la clave pública y la última sincronización', async () => {
    expect(await leerClavePublica()).toBeNull();
    expect(await leerUltimaSincronizacion()).toBeNull();
    await guardarClavePublica(clave);
    await guardarUltimaSincronizacion('2026-10-09T18:05:00.000Z');
    expect(await leerClavePublica()).toEqual(clave);
    expect(await leerUltimaSincronizacion()).toBe('2026-10-09T18:05:00.000Z');
  });

  it('encola y lista ordenado por ocurridoEn, sin importar el orden de llegada', async () => {
    await encolarEvento(evento('c', '2026-10-09T18:00:30.000Z'));
    await encolarEvento(evento('a', '2026-10-09T18:00:10.000Z'));
    await encolarEvento(evento('b', '2026-10-09T18:00:20.000Z'));
    expect((await listarCola()).map((e) => e.clientEventId)).toEqual(['a', 'b', 'c']);
    expect(await contarCola()).toBe(3);
  });

  it('encolar dos veces el mismo clientEventId no duplica', async () => {
    await encolarEvento(evento('a', '2026-10-09T18:00:10.000Z'));
    await encolarEvento(evento('a', '2026-10-09T18:00:10.000Z'));
    expect(await contarCola()).toBe(1);
  });

  it('borra eventos por id y deja el resto', async () => {
    await encolarEvento(evento('a', '2026-10-09T18:00:10.000Z'));
    await encolarEvento(evento('b', '2026-10-09T18:00:20.000Z'));
    await encolarEvento(evento('c', '2026-10-09T18:00:30.000Z'));
    await borrarEventos(['a', 'c', 'inexistente']);
    expect((await listarCola()).map((e) => e.clientEventId)).toEqual(['b']);
    await borrarEventos([]);
    expect(await contarCola()).toBe(1);
  });

  it('limpiarTodo vacía snapshot, cola y meta', async () => {
    await guardarSnapshot(snapshot('sA'));
    await guardarClavePublica(clave);
    await encolarEvento(evento('a', '2026-10-09T18:00:10.000Z'));
    await limpiarTodo();
    expect(await leerSnapshot('sA')).toBeNull();
    expect(await leerClavePublica()).toBeNull();
    expect(await contarCola()).toBe(0);
    expect(await listarCola()).toEqual([]);
  });

  it('los datos sobreviven a cerrar y reabrir la conexión', async () => {
    await encolarEvento(evento('a', '2026-10-09T18:00:10.000Z'));
    await cerrarAlmacen();
    expect(await contarCola()).toBe(1);
  });

  it('sin IndexedDB falla con un error tipado y legible', async () => {
    await cerrarAlmacen();
    vi.stubGlobal('indexedDB', undefined);
    const error = await contarCola().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AlmacenOfflineError);
    expect(error).toMatchObject({ codigo: 'NO_DISPONIBLE' });
    expect((error as Error).message).toMatch(/sin conexión/);
    // Un fallo al abrir no queda cacheado: al volver IndexedDB, funciona.
    vi.unstubAllGlobals();
    expect(await contarCola()).toBe(0);
  });
});
