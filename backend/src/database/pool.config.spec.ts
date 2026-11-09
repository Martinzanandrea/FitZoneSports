import {
  leerPoolConfig,
  opcionesDePool,
  POOL_POR_DEFECTO,
} from './pool.config';

const desde =
  (env: Record<string, string>) =>
  (k: string): string | undefined =>
    env[k];

describe('configuración del pool de base de datos', () => {
  it('sin variables usa los defaults', () => {
    expect(leerPoolConfig(desde({}))).toEqual(POOL_POR_DEFECTO);
  });

  it('lee los valores de las variables de entorno', () => {
    expect(
      leerPoolConfig(
        desde({
          DB_POOL_MAX: '5',
          DB_POOL_IDLE_TIMEOUT_MS: '1000',
          DB_POOL_CONNECTION_TIMEOUT_MS: '2000',
          DB_STATEMENT_TIMEOUT_MS: '3000',
        }),
      ),
    ).toEqual({
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
      statementTimeoutMillis: 3000,
    });
  });

  it.each(['', 'abc', '0', '-3', '2.5', 'NaN'])(
    'el valor inválido %p cae al default',
    (malo) => {
      expect(leerPoolConfig(desde({ DB_POOL_MAX: malo })).max).toBe(
        POOL_POR_DEFECTO.max,
      );
    },
  );

  it('se traduce a las opciones de TypeORM/pg', () => {
    const o = opcionesDePool(POOL_POR_DEFECTO);
    expect(o.poolSize).toBe(10);
    expect(o.extra).toEqual({
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    });
  });
});
