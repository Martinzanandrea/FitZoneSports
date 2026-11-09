#!/usr/bin/env node
// Migraciones de la base de FitZone Sports.
//
// Aplica en orden los scripts de db/sql/NNN-*.sql que todavía no corrieron y
// registra cada uno en la tabla schema_migraciones. La reversión de cada
// migración vive en db/sql/reversion/NNN-*.down.sql.
//
// Uso (desde server/):
//   node db/migrar.js subir              aplica todas las pendientes
//   node db/migrar.js revertir [n]       revierte las últimas n (por defecto 1)
//   node db/migrar.js estado             lista aplicadas y pendientes
//   node db/migrar.js seed               carga los datos de prueba
//                                        (db/seed/datos-prueba.sql)
//   node db/migrar.js marcar-aplicadas   registra todas como aplicadas sin
//                                        ejecutarlas (base creada a mano,
//                                        como la de Supabase)
//
// Toma la conexión de las mismas variables que la API (DB_HOST, DB_PORT,
// DB_USERNAME, DB_PASSWORD, DB_NAME, DB_SSL) y lee server/.env si existe.
//
// Los scripts de diagnóstico (nombre con "diagnostico") son consultas de solo
// lectura para correr a mano: no son migraciones y se saltean.
//
// Marcas que entiende dentro de un script:
//   -- migrar:sin-transaccion  cada tramo separado por "-- migrar:corte" se
//                              confirma por separado (ALTER TYPE ... ADD VALUE
//                              no puede usarse en la misma transacción).

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DIR_SQL = path.join(__dirname, 'sql');
const DIR_REVERSION = path.join(DIR_SQL, 'reversion');

function cargarEnv() {
  const archivo = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function conexion() {
  const ssl = (process.env.DB_SSL ?? 'true').toLowerCase() !== 'false';
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  };
}

function migraciones() {
  return fs
    .readdirSync(DIR_SQL)
    .filter((f) => /^\d{3}-.+\.sql$/.test(f) && !f.includes('diagnostico'))
    .sort()
    .map((archivo) => ({ version: archivo.slice(0, 3), archivo }));
}

// Quita los meta-comandos de psql (\restrict, \unrestrict) que agrega pg_dump:
// el driver de Node no los entiende.
function leerSql(ruta) {
  return fs
    .readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('\\'))
    .join('\n');
}

async function ejecutar(client, sql) {
  if (sql.includes('-- migrar:sin-transaccion')) {
    for (const tramo of sql.split('-- migrar:corte')) {
      if (tramo.replace(/--.*$/gm, '').trim()) await client.query(tramo);
    }
  } else {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  // 001 (export de pg_dump) vacía el search_path de la sesión.
  await client.query('SET search_path TO public');
}

async function asegurarTabla(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migraciones (
      version varchar(10) PRIMARY KEY,
      archivo varchar(200) NOT NULL,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);
}

async function aplicadas(client) {
  const { rows } = await client.query(
    'SELECT version, archivo, aplicada_en FROM public.schema_migraciones ORDER BY version',
  );
  return rows;
}

async function subir(client) {
  const hechas = new Set((await aplicadas(client)).map((r) => r.version));
  const pendientes = migraciones().filter((m) => !hechas.has(m.version));
  if (pendientes.length === 0) {
    console.log('La base está al día: no hay migraciones pendientes.');
    return;
  }
  for (const m of pendientes) {
    process.stdout.write(`Aplicando ${m.archivo}... `);
    await ejecutar(client, leerSql(path.join(DIR_SQL, m.archivo)));
    await asegurarTabla(client); // 001 recrea el esquema public
    await client.query(
      'INSERT INTO public.schema_migraciones (version, archivo) VALUES ($1, $2)',
      [m.version, m.archivo],
    );
    console.log('ok');
  }
}

async function revertir(client, cantidad) {
  const hechas = (await aplicadas(client)).reverse().slice(0, cantidad);
  if (hechas.length === 0) {
    console.log('No hay migraciones aplicadas para revertir.');
    return;
  }
  for (const m of hechas) {
    const archivo = m.archivo.replace(/\.sql$/, '.down.sql');
    const ruta = path.join(DIR_REVERSION, archivo);
    if (!fs.existsSync(ruta)) {
      throw new Error(`Falta la reversión de ${m.archivo} (${archivo})`);
    }
    process.stdout.write(`Revirtiendo ${m.archivo}... `);
    await ejecutar(client, leerSql(ruta));
    if (m.version === '001') {
      console.log('ok (esquema vacío)');
      return; // 001 borra el esquema completo, tabla de control incluida
    }
    await client.query('DELETE FROM public.schema_migraciones WHERE version = $1', [
      m.version,
    ]);
    console.log('ok');
  }
}

async function estado(client) {
  const hechas = new Map((await aplicadas(client)).map((r) => [r.version, r]));
  for (const m of migraciones()) {
    const h = hechas.get(m.version);
    const marca = h ? `aplicada ${h.aplicada_en.toISOString()}` : 'PENDIENTE';
    console.log(`${m.archivo.padEnd(48)} ${marca}`);
  }
}

async function seed(client) {
  const ruta = path.join(__dirname, 'seed', 'datos-prueba.sql');
  client.on('notice', (n) => console.log(n.message));
  await ejecutar(client, leerSql(ruta));
}

async function marcarAplicadas(client) {
  for (const m of migraciones()) {
    await client.query(
      `INSERT INTO public.schema_migraciones (version, archivo) VALUES ($1, $2)
       ON CONFLICT (version) DO NOTHING`,
      [m.version, m.archivo],
    );
  }
  console.log('Todas las migraciones quedaron registradas como aplicadas.');
}

async function main() {
  cargarEnv();
  const [comando = 'estado', arg] = process.argv.slice(2);
  const client = new Client(conexion());
  await client.connect();
  try {
    await asegurarTabla(client);
    if (comando === 'subir') await subir(client);
    else if (comando === 'revertir') await revertir(client, Number(arg ?? 1));
    else if (comando === 'estado') await estado(client);
    else if (comando === 'seed') await seed(client);
    else if (comando === 'marcar-aplicadas') await marcarAplicadas(client);
    else throw new Error(`Comando desconocido: ${comando}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
