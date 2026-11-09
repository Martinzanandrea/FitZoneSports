import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accesoApi } from '../acceso.api';
import {
  leerClavePublica,
  leerSnapshot,
  leerUltimaSincronizacion,
  limpiarTodo,
  guardarSnapshot,
  type SnapshotAcceso,
} from './almacenOffline';
import {
  aforoDisponible,
  buscarSocioEnSnapshot,
  conIngresoLocal,
  descargarSnapshot,
  estaDentro,
  fechaArgentina,
  snapshotVigente,
} from './snapshot';

vi.mock('../acceso.api', () => ({
  accesoApi: { getClavePublica: vi.fn(), getSnapshot: vi.fn(), sincronizar: vi.fn() },
}));

const HORA = 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-09T18:00:00Z'); // 15:00 en Argentina
const clave = { kid: 'a1b2c3d4', alg: 'ES256' as const, jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } };

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
    { id: 'u3', nombre: 'Cora', apellido: 'Luz', desde: '2026-10-20', hasta: '2026-11-20' },
  ],
  ...sobre,
});

beforeEach(async () => {
  vi.clearAllMocks();
  await limpiarTodo();
});

describe('descargarSnapshot', () => {
  it('trae clave y snapshot, los guarda y registra la fecha de sincronización', async () => {
    vi.mocked(accesoApi.getClavePublica).mockResolvedValue(clave);
    vi.mocked(accesoApi.getSnapshot).mockResolvedValue(snapshot());

    const r = await descargarSnapshot('sA');

    expect(accesoApi.getSnapshot).toHaveBeenCalledWith('sA');
    expect(r.sedeId).toBe('sA');
    expect(await leerSnapshot('sA')).toEqual(snapshot());
    expect(await leerClavePublica()).toEqual(clave);
    const fecha = await leerUltimaSincronizacion();
    expect(Date.parse(fecha ?? '')).not.toBeNaN();
  });

  it('si la API falla no guarda nada', async () => {
    vi.mocked(accesoApi.getClavePublica).mockResolvedValue(clave);
    vi.mocked(accesoApi.getSnapshot).mockRejectedValue(new Error('sin red'));
    await expect(descargarSnapshot('sA')).rejects.toThrow('sin red');
    expect(await leerSnapshot('sA')).toBeNull();
    expect(await leerClavePublica()).toBeNull();
    expect(await leerUltimaSincronizacion()).toBeNull();
  });
});

describe('snapshotVigente', () => {
  it('con 23 h de antigüedad es vigente', async () => {
    await guardarSnapshot(snapshot({ generadoEn: new Date(AHORA - 23 * HORA).toISOString() }));
    expect(await snapshotVigente('sA', AHORA)).toBe(true);
  });

  it('con 25 h de antigüedad no es vigente', async () => {
    await guardarSnapshot(snapshot({ generadoEn: new Date(AHORA - 25 * HORA).toISOString() }));
    expect(await snapshotVigente('sA', AHORA)).toBe(false);
  });

  it('con exactamente 24 h ya no es vigente', async () => {
    await guardarSnapshot(snapshot({ generadoEn: new Date(AHORA - 24 * HORA).toISOString() }));
    expect(await snapshotVigente('sA', AHORA)).toBe(false);
  });

  it('sin snapshot guardado no es vigente', async () => {
    expect(await snapshotVigente('sA', AHORA)).toBe(false);
  });

  it('con una fecha ilegible no es vigente', async () => {
    await guardarSnapshot(snapshot({ generadoEn: 'ayer' }));
    expect(await snapshotVigente('sA', AHORA)).toBe(false);
  });
});

describe('buscarSocioEnSnapshot', () => {
  it('un socio con membresía vigente hoy', () => {
    expect(buscarSocioEnSnapshot(snapshot(), 'u1', AHORA)).toEqual({ estado: 'VIGENTE', nombre: 'Ana', apellido: 'Paz' });
  });

  it('un socio con la membresía vencida', () => {
    expect(buscarSocioEnSnapshot(snapshot(), 'u2', AHORA)).toEqual({ estado: 'NO_VIGENTE', nombre: 'Beto', apellido: 'Gil' });
  });

  it('una membresía que todavía no empezó no es vigente', () => {
    expect(buscarSocioEnSnapshot(snapshot(), 'u3', AHORA).estado).toBe('NO_VIGENTE');
  });

  it('un usuario que no figura es DESCONOCIDO', () => {
    expect(buscarSocioEnSnapshot(snapshot(), 'nadie', AHORA)).toEqual({ estado: 'DESCONOCIDO', nombre: null, apellido: null });
  });

  it('hasta es exclusivo: el día de fecha_fin ya no vale', () => {
    const s = snapshot({ socios: [{ id: 'u1', nombre: 'Ana', apellido: 'Paz', desde: '2026-10-01', hasta: '2026-10-09' }] });
    expect(buscarSocioEnSnapshot(s, 'u1', AHORA).estado).toBe('NO_VIGENTE');
  });

  it('usa la fecha de Argentina, no la UTC: 23:30 del 9 todavía es 9', () => {
    const tarde = Date.parse('2026-10-10T02:30:00Z'); // 23:30 del 9 en Argentina
    expect(fechaArgentina(tarde)).toBe('2026-10-09');
    const s = snapshot({ socios: [{ id: 'u1', nombre: 'Ana', apellido: 'Paz', desde: '2026-10-01', hasta: '2026-10-10' }] });
    expect(buscarSocioEnSnapshot(s, 'u1', tarde).estado).toBe('VIGENTE');
  });
});

describe('dentro y aforo locales', () => {
  it('estaDentro mira la lista de ids', () => {
    expect(estaDentro(snapshot(), 'u9')).toBe(true);
    expect(estaDentro(snapshot(), 'u1')).toBe(false);
  });

  it('aforoDisponible es máximo menos actual, sin bajar de cero', () => {
    expect(aforoDisponible(snapshot())).toBe(2);
    expect(aforoDisponible(snapshot({ aforo: { actual: 9, maximo: 5 } }))).toBe(0);
  });

  it('conIngresoLocal suma al socio y al aforo sin mutar el original', () => {
    const original = snapshot();
    const nuevo = conIngresoLocal(original, 'u1');
    expect(nuevo.dentro).toEqual(['u9', 'u1']);
    expect(nuevo.aforo.actual).toBe(4);
    expect(original.dentro).toEqual(['u9']);
    expect(original.aforo.actual).toBe(3);
  });
});
