import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { accesoApi } from '../acceso.api';
import type { ResultadoSincronizacion } from '../acceso.types';
import {
  contarCola,
  encolarEvento,
  guardarClavePublica,
  guardarSnapshot,
  leerSnapshot,
  limpiarTodo,
  listarCola,
  type EventoOffline,
  type SnapshotAcceso,
} from './almacenOffline';
import { contarPendientes, leerResumenUltimaSync, sincronizarCola, validarIngresoOffline } from './colaIngresos';
import type { ClavePublica } from './verificarQr';

vi.mock('../acceso.api', () => ({
  accesoApi: { getClavePublica: vi.fn(), getSnapshot: vi.fn(), sincronizar: vi.fn() },
}));

const HORA = 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-09T18:00:00Z');
const SEG = Math.floor(AHORA / 1000);
const KID = 'a1b2c3d4';

const aBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jsonBase64Url = (o: unknown) => aBase64Url(new TextEncoder().encode(JSON.stringify(o)));

let par: CryptoKeyPair;
let clave: ClavePublica;

beforeAll(async () => {
  par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  clave = { kid: KID, alg: 'ES256', jwk: await crypto.subtle.exportKey('jwk', par.publicKey) };
});

async function qr(usuarioId: string, extra: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const h = jsonBase64Url({ alg: 'ES256', typ: 'JWT', kid: KID, ...header });
  const p = jsonBase64Url({ usuarioId, tipo: 'qr-acceso', jti: crypto.randomUUID(), iat: SEG, exp: SEG + 60, ...extra });
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, par.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${aBase64Url(new Uint8Array(firma))}`;
}

const snapshot = (sobre: Partial<SnapshotAcceso> = {}): SnapshotAcceso => ({
  sedeId: 'sA',
  generadoEn: new Date(AHORA - HORA).toISOString(),
  venceEn: new Date(AHORA + 23 * HORA).toISOString(),
  clave,
  aforo: { actual: 3, maximo: 5 },
  dentro: ['u9'],
  socios: [
    { id: 'u1', nombre: 'Ana', apellido: 'Paz', desde: '2026-10-01', hasta: '2026-11-01' },
    { id: 'u2', nombre: 'Beto', apellido: 'Gil', desde: '2026-08-01', hasta: '2026-09-01' },
    { id: 'u9', nombre: 'Zoe', apellido: 'Rey', desde: '2026-10-01', hasta: '2026-11-01' },
  ],
  ...sobre,
});

async function prepararSede(sobre: Partial<SnapshotAcceso> = {}) {
  await guardarClavePublica(clave);
  await guardarSnapshot(snapshot(sobre));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await limpiarTodo();
});

describe('validarIngresoOffline', () => {
  it('un QR válido encola el ingreso y actualiza dentro y aforo', async () => {
    await prepararSede();
    const token = await qr('u1');

    const r = await validarIngresoOffline('sA', token, AHORA);

    expect(r).toMatchObject({ permitido: true, nombre: 'Ana', apellido: 'Paz' });
    expect(r.mensaje).toContain('Ana Paz');
    const cola = await listarCola();
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ sedeId: 'sA', qrToken: token, ocurridoEn: new Date(AHORA).toISOString() });
    expect(cola[0].clientEventId).toMatch(/^[0-9a-f-]{36}$/);
    const local = await leerSnapshot('sA');
    expect(local?.dentro).toContain('u1');
    expect(local?.aforo.actual).toBe(4);
  });

  it('leer dos veces el mismo QR: la segunda ya figura dentro y no encola', async () => {
    await prepararSede();
    const token = await qr('u1');
    const [a, b] = await Promise.all([validarIngresoOffline('sA', token, AHORA), validarIngresoOffline('sA', token, AHORA)]);
    expect([a.permitido, b.permitido].sort()).toEqual([false, true]);
    expect(await contarCola()).toBe(1);
    expect((await leerSnapshot('sA'))?.aforo.actual).toBe(4);
  });

  const noEncola = async (esperado: Record<string, unknown>, token: string, ahora = AHORA) => {
    const r = await validarIngresoOffline('sA', token, ahora);
    expect(r).toMatchObject({ permitido: false, ...esperado });
    expect(r.mensaje).toMatch(/[a-záéíóú]/i);
    expect(await contarCola()).toBe(0);
    return r;
  };

  it('socio con membresía no vigente: rechaza con su nombre', async () => {
    await prepararSede();
    const r = await noEncola({ motivo: 'SOCIO_NO_VIGENTE', nombre: 'Beto' }, await qr('u2'));
    expect(r.mensaje).toContain('membresía');
  });

  it('socio que no figura en el snapshot: rechaza', async () => {
    await prepararSede();
    await noEncola({ motivo: 'SOCIO_DESCONOCIDO' }, await qr('desconocido'));
  });

  it('socio que ya figura dentro: rechaza', async () => {
    await prepararSede();
    await noEncola({ motivo: 'YA_DENTRO', nombre: 'Zoe' }, await qr('u9'));
  });

  it('aforo local completo: rechaza y no toca el snapshot', async () => {
    await prepararSede({ aforo: { actual: 5, maximo: 5 } });
    await noEncola({ motivo: 'AFORO_COMPLETO', nombre: 'Ana' }, await qr('u1'));
    expect((await leerSnapshot('sA'))?.dentro).toEqual(['u9']);
  });

  it('snapshot vencido (25 h): rechaza', async () => {
    await prepararSede({ generadoEn: new Date(AHORA - 25 * HORA).toISOString() });
    await noEncola({ motivo: 'SNAPSHOT_VENCIDO' }, await qr('u1'));
  });

  it('sin snapshot de la sede: rechaza', async () => {
    await noEncola({ motivo: 'SIN_SNAPSHOT' }, await qr('u1'));
  });

  it.each([
    ['basura', async () => 'no-es-un-jwt'],
    ['alg distinto de ES256', () => qr('u1', {}, { alg: 'HS256' })],
    ['kid desconocido', () => qr('u1', {}, { kid: 'otro' })],
    ['tipo distinto', () => qr('u1', { tipo: 'sesion' })],
  ])('token inválido (%s): rechaza', async (_n, construir) => {
    await prepararSede();
    await noEncola({ motivo: 'QR_INVALIDO' }, await construir());
  });

  it('QR firmado pero vencido: rechaza como QR_VENCIDO', async () => {
    await prepararSede();
    await noEncola({ motivo: 'QR_VENCIDO' }, await qr('u1'), AHORA + 61_000 + 5_000);
  });

  it('firma de otra clave: QR_INVALIDO', async () => {
    await prepararSede();
    const otra = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair;
    const h = jsonBase64Url({ alg: 'ES256', kid: KID });
    const p = jsonBase64Url({ usuarioId: 'u1', tipo: 'qr-acceso', jti: 'j', iat: SEG, exp: SEG + 60 });
    const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, otra.privateKey, new TextEncoder().encode(`${h}.${p}`));
    await noEncola({ motivo: 'QR_INVALIDO' }, `${h}.${p}.${aBase64Url(new Uint8Array(firma))}`);
  });
});

const evento = (n: number, sedeId = 'sA'): EventoOffline => ({
  clientEventId: `e${String(n).padStart(4, '0')}`,
  sedeId,
  qrToken: `tok${n}`,
  ocurridoEn: new Date(AHORA + n * 1000).toISOString(),
});
const resultado = (e: { clientEventId: string }, estado: ResultadoSincronizacion['estado'] = 'CREADO', codigo = 'OK') => ({
  clientEventId: e.clientEventId,
  estado,
  codigo,
});
const sincronizar = vi.mocked(accesoApi.sincronizar);
const errorHttp = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const idsEnCola = async () => (await listarCola()).map((e) => e.clientEventId);

describe('sincronizarCola', () => {
  it('sin nada en la cola no llama a la API', async () => {
    expect(await sincronizarCola()).toBeNull();
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('borra los procesados, cualquiera sea su estado, y guarda el resumen', async () => {
    const evs = [evento(1), evento(2), evento(3), evento(4)];
    for (const e of evs) await encolarEvento(e);
    sincronizar.mockResolvedValue({
      resultados: [
        resultado(evs[0]),
        resultado(evs[1], 'OBSERVADO', 'MEMBRESIA_NO_VIGENTE'),
        resultado(evs[2], 'CONFLICTO', 'SESION_ABIERTA'),
        resultado(evs[3], 'RECHAZADO', 'QR_VENCIDO'),
      ],
    });

    const r = await sincronizarCola();

    expect(r).toMatchObject({ creados: 1, observados: 1, conflictos: 1, rechazados: 1, fallidos: [] });
    expect(r?.interrumpida).toBeUndefined();
    expect(r?.detalle).toEqual([
      { clientEventId: 'e0002', estado: 'OBSERVADO', codigo: 'MEMBRESIA_NO_VIGENTE' },
      { clientEventId: 'e0003', estado: 'CONFLICTO', codigo: 'SESION_ABIERTA' },
      { clientEventId: 'e0004', estado: 'RECHAZADO', codigo: 'QR_VENCIDO' },
    ]);
    expect(await contarCola()).toBe(0);
    expect(await leerResumenUltimaSync()).toEqual(r);
    // Solo viajan los tres campos del contrato.
    expect(sincronizar.mock.calls[0][0].eventos[0]).toEqual({
      clientEventId: 'e0001',
      qrToken: 'tok1',
      ocurridoEn: evs[0].ocurridoEn,
    });
  });

  it('borra solo lo que aparece en la respuesta', async () => {
    const evs = [evento(1), evento(2)];
    for (const e of evs) await encolarEvento(e);
    sincronizar.mockResolvedValue({ resultados: [resultado(evs[0])] });
    await sincronizarCola();
    expect(await idsEnCola()).toEqual(['e0002']);
  });

  it.each([
    ['error de red', new Error('Network Error'), 'RED'],
    ['500', errorHttp(500), 'SERVIDOR'],
    ['503', errorHttp(503), 'SERVIDOR'],
    ['401', errorHttp(401), 'SESION'],
    ['403', errorHttp(403), 'SESION'],
  ])('%s: no borra nada y deja todo para reintentar', async (_n, error, causa) => {
    for (const e of [evento(1), evento(2)]) await encolarEvento(e);
    sincronizar.mockRejectedValue(error);

    const r = await sincronizarCola();

    expect(r?.interrumpida).toBe(causa);
    expect(await idsEnCola()).toEqual(['e0001', 'e0002']);
    expect(await contarPendientes()).toBe(2);
    expect(await leerResumenUltimaSync()).toBeNull();
    // Un reintento posterior sí vuelve a enviarlos.
    sincronizar.mockResolvedValue({ resultados: [resultado(evento(1)), resultado(evento(2))] });
    await sincronizarCola();
    expect(await contarCola()).toBe(0);
  });

  it('400: marca el lote como fallido, lo reporta y no lo reintenta', async () => {
    for (const e of [evento(1), evento(2)]) await encolarEvento(e);
    sincronizar.mockRejectedValue(errorHttp(400));

    const r = await sincronizarCola();

    expect(r?.fallidos).toEqual(['e0001', 'e0002']);
    expect(r?.interrumpida).toBeUndefined();
    expect(await leerResumenUltimaSync()).toMatchObject({ fallidos: ['e0001', 'e0002'] });
    // No se pierden los datos, pero tampoco cuentan como pendientes ni se reenvían.
    expect(await contarCola()).toBe(2);
    expect(await contarPendientes()).toBe(0);
    sincronizar.mockClear();
    expect(await sincronizarCola()).toBeNull();
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('un 400 en un lote no frena a los lotes de otras sedes', async () => {
    await encolarEvento(evento(1, 'sA'));
    await encolarEvento(evento(2, 'sB'));
    sincronizar.mockImplementation(async ({ sedeId, eventos }) => {
      if (sedeId === 'sA') throw errorHttp(400);
      return { resultados: eventos.map((e) => resultado(e)) };
    });
    const r = await sincronizarCola();
    expect(r).toMatchObject({ creados: 1, fallidos: ['e0001'] });
    expect(await idsEnCola()).toEqual(['e0001']);
  });

  it('envía en lotes de hasta 100, agrupados por sede y respetando el orden', async () => {
    for (let n = 1; n <= 250; n++) await encolarEvento(evento(n, n % 5 === 0 ? 'sB' : 'sA'));
    sincronizar.mockImplementation(async ({ eventos }) => ({ resultados: eventos.map((e) => resultado(e)) }));

    await sincronizarCola();

    const llamadas = sincronizar.mock.calls.map(([p]) => [p.sedeId, p.eventos.length]);
    // 200 eventos de sA (100 + 100) y 50 de sB.
    expect(llamadas).toEqual([['sA', 100], ['sA', 100], ['sB', 50]]);
    const idsA = sincronizar.mock.calls.filter(([p]) => p.sedeId === 'sA').flatMap(([p]) => p.eventos.map((e) => e.clientEventId));
    expect(idsA).toEqual([...idsA].sort());
    expect(await contarCola()).toBe(0);
  });

  it('si falla un lote posterior, conserva el resto y ya no borra los anteriores', async () => {
    for (let n = 1; n <= 150; n++) await encolarEvento(evento(n));
    sincronizar
      .mockImplementationOnce(async ({ eventos }) => ({ resultados: eventos.map((e) => resultado(e)) }))
      .mockRejectedValueOnce(errorHttp(502));

    const r = await sincronizarCola();

    expect(r).toMatchObject({ creados: 100, interrumpida: 'SERVIDOR' });
    expect(await contarCola()).toBe(50);
  });

  it('no corre dos veces en paralelo: la segunda llamada comparte la primera', async () => {
    await encolarEvento(evento(1));
    let liberar!: () => void;
    sincronizar.mockImplementation(
      ({ eventos }) =>
        new Promise((resolver) => {
          liberar = () => resolver({ resultados: eventos.map((e) => resultado(e)) });
        }),
    );

    const a = sincronizarCola();
    const b = sincronizarCola();
    await vi.waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    liberar();
    const [ra, rb] = await Promise.all([a, b]);

    expect(sincronizar).toHaveBeenCalledTimes(1);
    expect(rb).toBe(ra);
    // Terminada la primera, se puede volver a correr.
    await encolarEvento(evento(2));
    sincronizar.mockImplementation(async ({ eventos }) => ({ resultados: eventos.map((e) => resultado(e)) }));
    await sincronizarCola();
    expect(sincronizar).toHaveBeenCalledTimes(2);
  });
});
