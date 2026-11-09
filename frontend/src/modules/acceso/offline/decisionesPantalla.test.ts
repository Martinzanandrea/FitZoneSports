import { describe, expect, it } from 'vitest';
import type { ResumenSincronizacion } from './colaIngresos';
import {
  REFRESCO_SNAPSHOT_MS,
  controlesSegunConexion,
  debeDescargarSnapshot,
  debeMostrarResumen,
  debePasarAOffline,
  estadoBanner,
  rutaValidacionQr,
  textoPendientes,
  textoRequiereConexion,
  textoResumenSync,
} from './decisionesPantalla';

const AHORA = Date.parse('2026-10-09T18:00:00Z');
const http = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const sinRespuesta = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
const timeout = Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });

describe('rutaValidacionQr', () => {
  it('con conexión usa el flujo online, sin conexión el offline', () => {
    expect(rutaValidacionQr(true)).toBe('ONLINE');
    expect(rutaValidacionQr(false)).toBe('OFFLINE');
  });
});

describe('debePasarAOffline', () => {
  it('sin respuesta del servidor y timeout pasan a offline', () => {
    expect(debePasarAOffline(sinRespuesta, true)).toBe(true);
    expect(debePasarAOffline(timeout, true)).toBe(true);
  });

  it('un servidor caído (5xx) pasa a offline', () => {
    expect(debePasarAOffline(http(502), true)).toBe(true);
    expect(debePasarAOffline(http(503), true)).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422])('un %s del servidor es un rechazo real: no pasa a offline', (status) => {
    expect(debePasarAOffline(http(status), true)).toBe(false);
  });
});

describe('debeDescargarSnapshot', () => {
  const hace = (ms: number) => new Date(AHORA - ms).toISOString();

  it('sin snapshot descarga', () => {
    expect(debeDescargarSnapshot(null, AHORA)).toBe(true);
  });
  it('con menos de 1 hora no descarga', () => {
    expect(debeDescargarSnapshot(hace(REFRESCO_SNAPSHOT_MS - 1000), AHORA)).toBe(false);
  });
  it('con 1 hora o más descarga', () => {
    expect(debeDescargarSnapshot(hace(REFRESCO_SNAPSHOT_MS), AHORA)).toBe(true);
    expect(debeDescargarSnapshot(hace(30 * 60 * 60 * 1000), AHORA)).toBe(true);
  });
  it('con una fecha ilegible o del futuro descarga', () => {
    expect(debeDescargarSnapshot('ayer', AHORA)).toBe(true);
    expect(debeDescargarSnapshot(hace(-5 * 60 * 1000), AHORA)).toBe(true);
  });
});

describe('controles sin conexión', () => {
  it('sin conexión deshabilita código, DNI y egreso', () => {
    expect(controlesSegunConexion(true)).toEqual({ codigoDeshabilitado: true, dniDeshabilitado: true, egresoDeshabilitado: true });
  });
  it('con conexión no deshabilita nada', () => {
    expect(controlesSegunConexion(false)).toEqual({ codigoDeshabilitado: false, dniDeshabilitado: false, egresoDeshabilitado: false });
  });
  it('el texto explicativo existe para código y DNI sin conexión, y no para el QR', () => {
    expect(textoRequiereConexion('codigo', true)).toMatch(/requiere conexión/);
    expect(textoRequiereConexion('dni', true)).toMatch(/requiere conexión/);
    expect(textoRequiereConexion('camara', true)).toBeNull();
    expect(textoRequiereConexion('manual', true)).toBeNull();
    expect(textoRequiereConexion('dni', false)).toBeNull();
  });
});

describe('textoPendientes y estadoBanner', () => {
  it('singular, plural y cero', () => {
    expect(textoPendientes(0)).toMatch(/No hay/);
    expect(textoPendientes(1)).toBe('1 ingreso pendiente de sincronizar.');
    expect(textoPendientes(4)).toBe('4 ingresos pendientes de sincronizar.');
  });

  it('con conexión y sin pendientes no hay banner', () => {
    expect(estadoBanner({ sinConexion: false, snapshotVigente: true, pendientes: 0 }).visible).toBe(false);
  });

  it('con conexión y pendientes muestra el aviso de sincronización', () => {
    const b = estadoBanner({ sinConexion: false, snapshotVigente: true, pendientes: 3 });
    expect(b).toMatchObject({ visible: true, tono: 'aviso' });
    expect(b.lineas.join(' ')).toContain('3 ingresos pendientes');
  });

  it('sin conexión y snapshot vigente: modo sin conexión, tono de aviso', () => {
    const b = estadoBanner({ sinConexion: true, snapshotVigente: true, pendientes: 2 });
    expect(b).toMatchObject({ visible: true, tono: 'aviso', titulo: 'Modo sin conexión' });
    expect(b.lineas.join(' ')).toMatch(/vigentes/);
    expect(b.lineas.join(' ')).toContain('2 ingresos pendientes');
  });

  it('sin conexión y snapshot vencido o ausente: tono de error con el motivo', () => {
    const b = estadoBanner({ sinConexion: true, snapshotVigente: false, pendientes: 0 });
    expect(b).toMatchObject({ visible: true, tono: 'error' });
    expect(b.lineas[0]).toMatch(/No se pueden validar ingresos sin conexión/);
  });
});

const resumen = (sobre: Partial<ResumenSincronizacion> = {}): ResumenSincronizacion => ({
  fecha: '2026-10-09T18:05:00.000Z',
  creados: 0,
  observados: 0,
  conflictos: 0,
  rechazados: 0,
  detalle: [],
  fallidos: [],
  ...sobre,
});

describe('textoResumenSync', () => {
  it('todo creado: tono ok y conteos', () => {
    const t = textoResumenSync(resumen({ creados: 5 }));
    expect(t.tono).toBe('ok');
    expect(t.conteos).toBe('Creados: 5. Observados: 0. Conflictos: 0. Rechazados: 0.');
    expect(t.detalle).toEqual([]);
    expect(t.interrupcion).toBeNull();
  });

  it('solo observados: tono de aviso', () => {
    expect(textoResumenSync(resumen({ creados: 1, observados: 1 })).tono).toBe('aviso');
  });

  it('conflictos o rechazados: tono de error y detalle legible de los no CREADO', () => {
    const t = textoResumenSync(
      resumen({
        creados: 1,
        conflictos: 1,
        rechazados: 1,
        detalle: [
          { clientEventId: 'abcdef1234567890', estado: 'CONFLICTO', codigo: 'SESION_ABIERTA' },
          { clientEventId: '1234567890abcdef', estado: 'RECHAZADO', codigo: 'CODIGO_NUEVO' },
        ],
      }),
    );
    expect(t.tono).toBe('error');
    expect(t.detalle[0].texto).toBe('Ingreso abcdef12: Conflicto. El socio ya tenía un ingreso abierto.');
    // Un código que la pantalla no conoce se muestra tal cual, sin inventar texto.
    expect(t.detalle[1].texto).toBe('Ingreso 12345678: Rechazado. CODIGO_NUEVO.');
  });

  it('una sincronización interrumpida o con lotes fallidos es un error con explicación', () => {
    const i = textoResumenSync(resumen({ interrumpida: 'RED' }));
    expect(i.tono).toBe('error');
    expect(i.interrupcion).toMatch(/falta de conexión/);
    const f = textoResumenSync(resumen({ fallidos: ['a', 'b'] }));
    expect(f.tono).toBe('error');
    expect(f.fallidos).toMatch(/2 ingreso\(s\)/);
  });
});

describe('debeMostrarResumen', () => {
  it('no hay resumen: no se muestra', () => {
    expect(debeMostrarResumen(null, false, null)).toBe(false);
  });
  it('sin conexión no se muestra', () => {
    expect(debeMostrarResumen(resumen({ creados: 1 }), true, null)).toBe(false);
  });
  it('con conexión y algo para contar se muestra', () => {
    expect(debeMostrarResumen(resumen({ creados: 1 }), false, null)).toBe(true);
    expect(debeMostrarResumen(resumen({ interrumpida: 'SERVIDOR' }), false, null)).toBe(true);
  });
  it('un resumen vacío no se muestra', () => {
    expect(debeMostrarResumen(resumen(), false, null)).toBe(false);
  });
  it('un resumen ya descartado no vuelve a aparecer', () => {
    const r = resumen({ creados: 1 });
    expect(debeMostrarResumen(r, false, r.fecha)).toBe(false);
    expect(debeMostrarResumen(r, false, 'otra-fecha')).toBe(true);
  });
});
