import { parsearExpiracionMs } from './jwt-expiracion.helper';

const OCHO_HORAS = 8 * 60 * 60 * 1000;

describe('parsearExpiracionMs', () => {
  it.each([
    ['8h', 8 * 60 * 60 * 1000],
    ['30m', 30 * 60 * 1000],
    ['1m', 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
    ['45s', 45 * 1000],
    [' 2H ', 2 * 60 * 60 * 1000],
    ['3600', 3600 * 1000],
    [90, 90 * 1000],
  ])('interpreta %p', (entrada, esperado) => {
    expect(parsearExpiracionMs(entrada)).toBe(esperado);
  });

  it.each([undefined, null, '', 'abc', '8x', '-5m', '0h', 0, -1, NaN, {}])(
    'usa 8h como fallback para %p',
    (entrada) => {
      expect(parsearExpiracionMs(entrada)).toBe(OCHO_HORAS);
    },
  );
});
