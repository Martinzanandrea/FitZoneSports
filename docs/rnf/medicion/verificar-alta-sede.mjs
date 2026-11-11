#!/usr/bin/env node
// Verificación de RNF-04: alta de una sede por la API, con el sistema en marcha.
//
// Mientras la API atiende, una sonda consulta GET /canchas/publico cada 100 ms. En paralelo, el gerente
// general crea una sede (POST /sedes) y su franja horaria (POST /sedes/:id/franjas). Al final se
// comprueba que la sede aparece en el listado y que la sesión iniciada ANTES del alta sigue válida
// (GET /auth/me), y se informa si la sonda tuvo algún fallo durante el alta.
//
// ESCRIBE una sede en la base a la que apunta el backend: exige --base-de-prueba y una API local.
//
// Uso:  node docs/rnf/medicion/verificar-alta-sede.mjs --api http://localhost:3100 --base-de-prueba
//       (guarda docs/rnf/medicion/resultado-alta-sede-AAAA-MM-DD.json)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const API = opt('api', 'http://localhost:3100').replace(/\/$/, '');
if (!args.includes('--base-de-prueba')) {
  console.error('Este script escribe una sede. Confirmá que el backend usa una base de PRUEBA con --base-de-prueba.');
  process.exit(2);
}
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(API).hostname)) {
  console.error(`La API (${API}) no es local.`);
  process.exit(2);
}

async function http(metodo, ruta, { cookie, cuerpo } = {}) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: { ...(cookie ? { cookie } : {}), ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* no JSON */ }
  return { status: res.status, json, res };
}

const login = await http('POST', '/auth/login', { cuerpo: { email: 'gerente@fitzone.test', password: 'FitZone2026!' } });
if (login.status >= 300) throw new Error(`Login del gerente general falló (${login.status})`);
const cookie = login.res.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('token='));

const listar = async () => {
  const r = await http('GET', '/sedes?limit=100', { cookie });
  return Array.isArray(r.json) ? r.json : (r.json?.data ?? []);
};
const antes = await listar();

// Sonda de disponibilidad
let sondeos = 0;
let fallos = 0;
let corriendo = true;
const sonda = (async () => {
  while (corriendo) {
    try {
      const r = await http('GET', '/canchas/publico');
      sondeos++;
      if (r.status !== 200) fallos++;
    } catch {
      sondeos++;
      fallos++;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
})();
await new Promise((r) => setTimeout(r, 1000)); // la sonda corre antes del alta

const nombre = `Sede de verificación RNF-04 ${new Date().toISOString()}`;
const alta = await http('POST', '/sedes', { cookie, cuerpo: { nombre, direccion: 'Dirección de prueba 123', aforoMaximo: 80, activa: true } });
const sedeId = alta.json?.id;
const franja = sedeId ? await http('POST', `/sedes/${sedeId}/franjas`, { cookie, cuerpo: { apertura: '08:00', cierre: '22:00' } }) : { status: null };
await new Promise((r) => setTimeout(r, 1000)); // la sonda sigue corriendo después del alta
corriendo = false;
await sonda;

const despues = await listar();
const sesion = await http('GET', '/auth/me', { cookie });
const resultado = {
  fecha: new Date().toISOString(),
  node: process.version,
  sistema: `${os.type()} ${os.release()}`,
  api: API,
  sedes_antes: antes.length,
  alta_sede: { status: alta.status, id: sedeId ?? null },
  alta_franja: { status: franja.status },
  sedes_despues: despues.length,
  la_sede_aparece_en_el_listado: despues.some((s) => s.id === sedeId),
  sesion_previa_sigue_valida: sesion.status === 200,
  sonda_disponibilidad: { consultas: sondeos, fallos },
  conclusion_automatica:
    alta.status === 201 && franja.status === 201 && despues.some((s) => s.id === sedeId) && sesion.status === 200 && fallos === 0
      ? 'Alta de sede con el sistema en marcha: sin reinicio, sin fallos de la sonda y con la sesión previa vigente.'
      : 'REVISAR: alguna comprobación falló (ver el detalle).',
};
const salida = path.join(AQUI, `resultado-alta-sede-${resultado.fecha.slice(0, 10)}.json`);
fs.writeFileSync(salida, JSON.stringify(resultado, null, 2) + '\n');
console.log(JSON.stringify(resultado, null, 2));
