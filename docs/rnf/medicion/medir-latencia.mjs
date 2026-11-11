#!/usr/bin/env node
// Medición de latencia de los endpoints principales de la API (evidencia de RNF-03).
//
// Mide, contra un backend local con una base de datos DE PRUEBA, el p50 y el p95 de:
//   login · listado de clases · reserva de cancha · snapshot de acceso · validación de QR
// con 200 repeticiones cada uno (más unas pocas de calentamiento que no se cuentan).
//
// Sin dependencias nuevas: usa `fetch` de Node 20+ y, solo para describir los datos del seed,
// el paquete `pg` ya instalado en backend/node_modules.
//
// ESCRIBE DATOS (reservas, ingresos, auditoría) en la base a la que apunta el backend. Por eso:
//   - exige --base-de-prueba;
//   - se niega a correr si la API o DB_HOST no son locales.
//
// Uso (desde la raíz del repositorio), con el backend ya levantado sobre la base de prueba:
//   DB_HOST=127.0.0.1 DB_PORT=55432 DB_USERNAME=postgres DB_PASSWORD=... DB_NAME=fitzone_rnf DB_SSL=false \
//     node docs/rnf/medicion/medir-latencia.mjs --api http://localhost:3100 --base-de-prueba
//
// Opciones: --repeticiones 200 · --calentamiento 5 · --salida docs/rnf/medicion
//
// Límites de la API que el script respeta (no los modifica):
//   - POST /auth/login: 5 intentos por minuto por IP  -> una repetición cada ~12,5 s (≈ 42 min).
//   - Resto de endpoints: pausa mínima de 450 ms entre pedidos para no superar 200 por minuto.
//   - Un 429 no se registra como medición: se espera y se repite.
// Los resultados se calculan SOLO con respuestas 2xx; los errores se informan aparte.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..');

// ------------------------------------------------------------------ argumentos
const args = process.argv.slice(2);
const opt = (n, def) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const API = opt('api', 'http://localhost:3100').replace(/\/$/, '');
const REPS = Number(opt('repeticiones', 200));
const CALENT = Number(opt('calentamiento', 5));
const SALIDA = path.resolve(RAIZ, opt('salida', 'docs/rnf/medicion'));
const PASSWORD = 'FitZone2026!'; // contraseña de los usuarios de prueba (README, sección 4)
const PAUSA_MS = 450;
const PAUSA_LOGIN_MS = 12500;

const esLocal = (h) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(h);
if (!args.includes('--base-de-prueba')) {
  console.error('Este script escribe datos. Confirmá que el backend apunta a una base de PRUEBA con --base-de-prueba.');
  process.exit(2);
}
if (!esLocal(new URL(API).hostname)) {
  console.error(`La API (${API}) no es local: no se mide.`);
  process.exit(2);
}
if (!process.env.DB_HOST || !esLocal(process.env.DB_HOST)) {
  console.error('DB_HOST debe estar definido y ser local (es la base que el backend usa; el script la describe y la verifica).');
  process.exit(2);
}

// ------------------------------------------------------------------ utilidades
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ultimo = 0;
async function pausar(ms) {
  const espera = ultimo + ms - Date.now();
  if (espera > 0) await dormir(espera);
  ultimo = Date.now();
}

async function http(metodo, ruta, { cookie, cuerpo } = {}) {
  for (let intento = 0; intento < 8; intento++) {
    const t0 = performance.now();
    const res = await fetch(API + ruta, {
      method: metodo,
      headers: { ...(cookie ? { cookie } : {}), ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const texto = await res.text();
    const ms = performance.now() - t0;
    if (res.status === 429) {
      await dormir(15000); // límite de la API: no es una medición
      continue;
    }
    let json = null;
    try { json = JSON.parse(texto); } catch { /* respuesta no JSON */ }
    return { status: res.status, ms, json, res };
  }
  throw new Error(`${metodo} ${ruta}: 429 reiterado`);
}

async function login(email) {
  const r = await http('POST', '/auth/login', { cuerpo: { email, password: PASSWORD } });
  if (r.status >= 300) throw new Error(`Login de ${email} falló (${r.status}): ${JSON.stringify(r.json)}`);
  const cookie = (r.res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('token='));
  if (!cookie) throw new Error('El login no devolvió la cookie token');
  return { cookie, usuario: r.json };
}

const percentil = (ordenado, p) => ordenado[Math.max(0, Math.ceil((p / 100) * ordenado.length) - 1)]; // rango más cercano
function resumen(ms, errores, detalle) {
  const o = [...ms].sort((a, b) => a - b);
  const f = (x) => (x === undefined ? null : Math.round(x * 100) / 100);
  return {
    muestras_ok: o.length,
    errores,
    p50_ms: f(percentil(o, 50)),
    p95_ms: f(percentil(o, 95)),
    min_ms: f(o[0]),
    max_ms: f(o[o.length - 1]),
    media_ms: f(o.reduce((a, b) => a + b, 0) / (o.length || 1)),
    ...(detalle ? { detalle } : {}),
  };
}

// Corre `paso()` CALENT veces (sin contar) y REPS veces (contando). `paso(i)` devuelve {status, ms}.
async function medir(nombre, paso, pausa = PAUSA_MS) {
  process.stdout.write(`${nombre}: `);
  const ok = [];
  const estados = {};
  let errores = 0;
  for (let i = -CALENT; i < REPS; i++) {
    await pausar(pausa);
    const r = await paso(i);
    if (i < 0) continue;
    if (r.status >= 200 && r.status < 300) ok.push(r.ms);
    else {
      errores++;
      estados[r.status] = (estados[r.status] ?? 0) + 1;
    }
    if ((i + 1) % 50 === 0) process.stdout.write(`${i + 1} `);
  }
  console.log('listo');
  return resumen(ok, errores, errores ? { estados_con_error: estados } : undefined);
}

// ------------------------------------------------------------------ base de datos (solo lectura)
async function datosDelSeed() {
  const req = createRequire(path.join(RAIZ, 'backend', 'package.json'));
  const { Client } = req('pg');
  const c = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: (process.env.DB_SSL ?? 'true').toLowerCase() !== 'false' ? { rejectUnauthorized: false } : false,
  });
  await c.connect();
  try {
    const version = (await c.query('select version() as v')).rows[0].v;
    const tablas = (await c.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")).rows;
    const filas = {};
    for (const { table_name: t } of tablas) filas[t] = Number((await c.query(`select count(*) as n from "${t}"`)).rows[0].n);
    return { version, filas };
  } finally {
    await c.end();
  }
}

// ------------------------------------------------------------------ ejecución
const inicio = new Date();
console.log(`Medición de latencia · ${inicio.toISOString()} · API ${API} · ${REPS} repeticiones (+${CALENT} de calentamiento)`);
const antes = await datosDelSeed();
console.log('Filas por tabla antes de medir:', JSON.stringify(antes.filas));

// Preparación (no se mide)
const recep = await login('recepcion1@fitzone.test');
const socio = await login('socio1.1@fitzone.test');
const sedeId = recep.usuario.sedeId;
if (!sedeId) throw new Error('El recepcionista de prueba no tiene sede');
const canchas = await http('GET', '/canchas?limit=100', { cookie: socio.cookie });
const listaCanchas = canchas.json?.data ?? canchas.json ?? [];
const cancha = listaCanchas.find((c) => c.sede?.id === sedeId) ?? listaCanchas[0];
if (!cancha) throw new Error('No hay canchas en el seed');

// Turnos libres: de mañana en adelante, 15 turnos por día (08:00 a 22:00), una cancha.
const hoyAR = new Date(Date.now() - 3 * 3600 * 1000);
const turno = (i) => {
  const d = new Date(Date.UTC(hoyAR.getUTCFullYear(), hoyAR.getUTCMonth(), hoyAR.getUTCDate() + 1 + Math.floor((i + CALENT) / 15)));
  const h = 8 + ((i + CALENT) % 15);
  const hh = (n) => String(n).padStart(2, '0');
  return { fecha: d.toISOString().slice(0, 10), horaInicio: `${hh(h)}:00`, horaFin: `${hh(h + 1)}:00` };
};

const resultados = {};
const guardarParcial = () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  fs.writeFileSync(path.join(SALIDA, 'parcial-latencia.json'), JSON.stringify({ inicio: inicio.toISOString(), repeticiones: REPS, endpoints: resultados }, null, 2) + '\n');
};
resultados['GET /clases (listado de clases)'] = await medir('listado de clases', () =>
  http('GET', `/clases?sedeId=${sedeId}`, { cookie: socio.cookie }));

resultados['POST /reservas-cancha (reserva de cancha)'] = await medir('reserva de cancha', (i) =>
  http('POST', '/reservas-cancha', {
    cookie: socio.cookie,
    cuerpo: { canchaId: cancha.id, usuarioId: socio.usuario.id, ...turno(i) },
  }));

resultados['GET /acceso/snapshot/:sedeId (snapshot de acceso)'] = await medir('snapshot de acceso', () =>
  http('GET', `/acceso/snapshot/${sedeId}`, { cookie: recep.cookie }));

// Validación de QR: por repetición se genera un QR (no medido), se valida (medido) y se registra el
// egreso (no medido) para liberar la sesión abierta (RN-01) y poder repetir.
resultados['POST /acceso/validar (validación de QR)'] = await medir('validación de QR', async () => {
  const q = await http('GET', `/acceso/qr/${socio.usuario.id}`, { cookie: socio.cookie });
  if (q.status >= 300 || !q.json?.qrToken) return { status: q.status || 599, ms: 0 };
  await pausar(PAUSA_MS);
  const v = await http('POST', '/acceso/validar', { cookie: recep.cookie, cuerpo: { qrToken: q.json.qrToken, sedeId } });
  await pausar(PAUSA_MS);
  await http('POST', '/acceso/egreso', { cookie: recep.cookie, cuerpo: { usuarioId: socio.usuario.id } });
  return v;
});

// Login: límite de 5 por minuto por IP -> una repetición cada ~12,5 s. Va al final porque es la más larga.
guardarParcial();
await dormir(61000); // vaciar la ventana del límite tras los inicios de sesión de preparación
resultados['POST /auth/login (inicio de sesión)'] = await medir(
  'login (≈ 42 min por el límite de 5/min de la API)',
  () => http('POST', '/auth/login', { cuerpo: { email: 'socio1.1@fitzone.test', password: PASSWORD } }),
  PAUSA_LOGIN_MS,
);

let despues = null;
try { despues = await datosDelSeed(); } catch (e) { console.warn('No se pudo leer la base al final (se informa sin esa parte):', e.code ?? e.message); }
const fin = new Date();
const cpus = os.cpus();
fs.rmSync(path.join(SALIDA, 'parcial-latencia.json'), { force: true });
const salida = {
  fecha_inicio: inicio.toISOString(),
  fecha_fin: fin.toISOString(),
  zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone,
  repeticiones: REPS,
  calentamiento_no_contado: CALENT,
  metodo: 'Tiempo de pared medido en el cliente (performance.now) desde el envío hasta leer el cuerpo completo, por loopback; percentiles por rango más cercano; solo respuestas 2xx.',
  node: process.version,
  hardware: {
    sistema: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus[0]?.model?.trim(),
    nucleos_logicos: cpus.length,
    memoria_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  },
  api: API,
  base_de_datos: antes.version,
  filas_del_seed_antes: antes.filas,
  filas_despues: despues ? despues.filas : null,
  endpoints: resultados,
};

fs.mkdirSync(SALIDA, { recursive: true });
const dia = inicio.toISOString().slice(0, 10);
fs.writeFileSync(path.join(SALIDA, `resultados-latencia-${dia}.json`), JSON.stringify(salida, null, 2) + '\n');

const tabla = Object.entries(resultados)
  .map(([n, r]) => `| ${n} | ${r.muestras_ok} | ${r.errores} | ${r.p50_ms} | ${r.p95_ms} | ${r.min_ms} | ${r.max_ms} |`)
  .join('\n');
fs.writeFileSync(
  path.join(SALIDA, `resultados-latencia-${dia}.md`),
  `# Resultados de latencia (generado por medir-latencia.mjs)\n\nInicio: ${salida.fecha_inicio} · Fin: ${salida.fecha_fin} · Node ${salida.node}\n\n` +
    `| Endpoint | Muestras 2xx | Errores | p50 (ms) | p95 (ms) | Mín (ms) | Máx (ms) |\n|---|---|---|---|---|---|---|\n${tabla}\n`,
);
console.log(`\nResultados guardados en ${path.relative(RAIZ, SALIDA)} (resultados-latencia-${dia}.json y .md)`);
