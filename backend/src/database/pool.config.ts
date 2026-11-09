// Pool de conexiones de pg (vía TypeORM), pensado para el pooler de Supabase.
// Todo se lee de variables de entorno, con defaults razonables:
//
//   DB_POOL_MAX                      máximo de conexiones del pool      (10)
//   DB_POOL_IDLE_TIMEOUT_MS          cierra una conexión ociosa tras…   (30000)
//   DB_POOL_CONNECTION_TIMEOUT_MS    espera máx. para obtener conexión  (10000)
//   DB_STATEMENT_TIMEOUT_MS          corta una consulta que dura más de… (30000)
//
// Por qué estos valores: el pooler de Supabase (Supavisor) reparte un número
// acotado de conexiones reales entre todos los clientes; un pool grande en una
// sola instancia las agota. 10 alcanza de sobra para <100 usuarios. El timeout
// de conexión evita que una request quede colgada para siempre si el pool está
// lleno; el de ociosidad devuelve conexiones al pooler. El de sentencia
// protege de consultas colgadas (los locks de reserva son transacciones
// cortas). Para subirlos, tener en cuenta max_connections del plan de Supabase
// dividido entre las instancias del servidor.

export interface PoolConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeoutMillis: number;
}

export const POOL_POR_DEFECTO: PoolConfig = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statementTimeoutMillis: 30_000,
};

// Entero positivo o el valor por defecto (un valor ausente, vacío, no
// numérico, cero o negativo nunca llega al pool).
function enteroPositivo(valor: unknown, porDefecto: number): number {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
}

export function leerPoolConfig(
  get: (clave: string) => string | number | undefined,
): PoolConfig {
  return {
    max: enteroPositivo(get('DB_POOL_MAX'), POOL_POR_DEFECTO.max),
    idleTimeoutMillis: enteroPositivo(
      get('DB_POOL_IDLE_TIMEOUT_MS'),
      POOL_POR_DEFECTO.idleTimeoutMillis,
    ),
    connectionTimeoutMillis: enteroPositivo(
      get('DB_POOL_CONNECTION_TIMEOUT_MS'),
      POOL_POR_DEFECTO.connectionTimeoutMillis,
    ),
    statementTimeoutMillis: enteroPositivo(
      get('DB_STATEMENT_TIMEOUT_MS'),
      POOL_POR_DEFECTO.statementTimeoutMillis,
    ),
  };
}

// Opciones que se mezclan en la config de TypeORM (tipo postgres).
export function opcionesDePool(pool: PoolConfig) {
  return {
    poolSize: pool.max, // TypeORM -> `max` de pg.Pool
    extra: {
      max: pool.max,
      idleTimeoutMillis: pool.idleTimeoutMillis,
      connectionTimeoutMillis: pool.connectionTimeoutMillis,
      statement_timeout: pool.statementTimeoutMillis,
    },
  };
}
