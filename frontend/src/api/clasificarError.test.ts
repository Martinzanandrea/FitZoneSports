import { describe, expect, it } from 'vitest';
import { clasificarError, decidirTrasFalloAlArrancar, esFalloDeConectividad } from './clasificarError';

const conRespuesta = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
// Los errores sin respuesta de axios: sin red, timeout y petición cancelada.
const errorDeRed = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', request: {} });
const timeout = Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED', request: {} });
const cancelado = Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' });

describe('clasificarError', () => {
  it.each([
    ['error de red', errorDeRed],
    ['timeout', timeout],
    ['petición cancelada', cancelado],
    ['un Error cualquiera sin response', new Error('x')],
    ['null', null],
    ['undefined', undefined],
    ['response sin status', { response: {} }],
  ])('%s: RED', (_n, err) => {
    expect(clasificarError(err)).toBe('RED');
  });

  it.each([401, 403])('%s: AUTENTICACION', (status) => {
    expect(clasificarError(conRespuesta(status))).toBe('AUTENTICACION');
  });

  it.each([500, 502, 503, 504])('%s: SERVIDOR', (status) => {
    expect(clasificarError(conRespuesta(status))).toBe('SERVIDOR');
  });

  it.each([400, 404, 409, 422, 429])('%s: OTRO', (status) => {
    expect(clasificarError(conRespuesta(status))).toBe('OTRO');
  });
});

describe('esFalloDeConectividad', () => {
  it('red, timeout y 5xx lo son', () => {
    for (const e of [errorDeRed, timeout, conRespuesta(500), conRespuesta(503)]) {
      expect(esFalloDeConectividad(e, true)).toBe(true);
    }
  });

  it('401, 403 y otras respuestas de negocio no lo son', () => {
    for (const e of [conRespuesta(401), conRespuesta(403), conRespuesta(404), conRespuesta(409)]) {
      expect(esFalloDeConectividad(e, true)).toBe(false);
    }
  });

  it('con navigator.onLine en false, un error sin respuesta es de conectividad', () => {
    expect(esFalloDeConectividad(new Error('algo raro'), false)).toBe(true);
  });

  it('con navigator.onLine en false, una respuesta del servidor sigue valiendo lo que dice', () => {
    expect(esFalloDeConectividad(conRespuesta(401), false)).toBe(false);
    expect(esFalloDeConectividad(conRespuesta(403), false)).toBe(false);
  });
});

describe('decidirTrasFalloAlArrancar', () => {
  it('sesión local + error de red: conserva sin verificar', () => {
    expect(decidirTrasFalloAlArrancar(errorDeRed, true, true)).toBe('CONSERVAR_SIN_VERIFICAR');
  });

  it('sesión local + timeout: conserva', () => {
    expect(decidirTrasFalloAlArrancar(timeout, true, true)).toBe('CONSERVAR_SIN_VERIFICAR');
  });

  it('sesión local + navigator.onLine false: conserva', () => {
    expect(decidirTrasFalloAlArrancar(new Error('x'), false, true)).toBe('CONSERVAR_SIN_VERIFICAR');
  });

  it('sesión local + 5xx (servidor caído): conserva', () => {
    expect(decidirTrasFalloAlArrancar(conRespuesta(502), true, true)).toBe('CONSERVAR_SIN_VERIFICAR');
  });

  it('401 cierra sesión como antes, aunque haya sesión local', () => {
    expect(decidirTrasFalloAlArrancar(conRespuesta(401), true, true)).toBe('CERRAR_SESION');
  });

  it('403 (usuario desactivado) cierra sesión como antes', () => {
    expect(decidirTrasFalloAlArrancar(conRespuesta(403), true, true)).toBe('CERRAR_SESION');
  });

  it('otras respuestas del servidor (404, 429) cierran sesión como antes', () => {
    expect(decidirTrasFalloAlArrancar(conRespuesta(404), true, true)).toBe('CERRAR_SESION');
    expect(decidirTrasFalloAlArrancar(conRespuesta(429), true, true)).toBe('CERRAR_SESION');
  });

  it('sin sesión local no se entra sin conexión', () => {
    expect(decidirTrasFalloAlArrancar(errorDeRed, false, false)).toBe('CERRAR_SESION');
    expect(decidirTrasFalloAlArrancar(timeout, true, false)).toBe('CERRAR_SESION');
    expect(decidirTrasFalloAlArrancar(conRespuesta(503), true, false)).toBe('CERRAR_SESION');
  });
});
