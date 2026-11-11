import { describe, expect, it } from 'vitest';
import { esRuidoDelNavegador, mensajeDeErrorInesperado, primerasLineas } from './errores';

describe('mensajeDeErrorInesperado', () => {
  it('toma el message de un Error', () => {
    expect(mensajeDeErrorInesperado(new TypeError('Cannot read properties of undefined (reading x)'))).toContain('reading');
  });
  it('acepta strings (html5-qrcode rechaza con texto)', () => {
    expect(mensajeDeErrorInesperado('Cannot stop, scanner is not running or paused.')).toBe('Cannot stop, scanner is not running or paused.');
  });
  it('acepta objetos con message y objetos sin message', () => {
    expect(mensajeDeErrorInesperado({ message: 'boom' })).toBe('boom');
    expect(mensajeDeErrorInesperado({ a: 1 })).toBe('{"a":1}');
  });
  it('no falla con null, undefined ni referencias circulares', () => {
    expect(mensajeDeErrorInesperado(null)).toBe('null');
    expect(mensajeDeErrorInesperado(undefined)).toBe('undefined');
    const c: Record<string, unknown> = {};
    c.yo = c;
    expect(typeof mensajeDeErrorInesperado(c)).toBe('string');
  });
});

describe('primerasLineas', () => {
  it('devuelve solo las primeras n líneas no vacías', () => {
    const t = '\n  a\n b\n\n c\n d\n e\n f\n g';
    expect(primerasLineas(t, 5)).toBe('a\nb\nc\nd\ne');
  });
  it('tolera null y undefined', () => {
    expect(primerasLineas(null)).toBe('');
    expect(primerasLineas(undefined)).toBe('');
  });
});

describe('esRuidoDelNavegador', () => {
  it('ignora el aviso de ResizeObserver', () => {
    expect(esRuidoDelNavegador('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(esRuidoDelNavegador('TypeError: x is undefined')).toBe(false);
  });
});
