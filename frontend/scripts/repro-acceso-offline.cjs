// Reproducción del Control de acceso con dos ciclos de corte y reconexión.
// Corre la app REAL (vite dev) en Chromium con emulación móvil. El backend se simula con page.route
// (no hay base de datos disponible en este equipo): usuario recepcionista, snapshot firmado con una
// clave ES256 generada acá, y POST /acceso/sincronizar que responde CREADO.
//
// Uso: VITE_API_URL=http://mock.test npx vite --port 5199   (en otra terminal)
//      node scripts/repro-acceso-offline.cjs [http://localhost:5199] [carpeta-de-capturas]
// Requiere el paquete "playwright" (no es dependencia del proyecto): NODE_PATH o PLAYWRIGHT_MODULE.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.argv[2] || 'http://localhost:5199';
const OUT = process.argv[3] || path.join(__dirname, 'repro-capturas');
fs.mkdirSync(OUT, { recursive: true });

const API = 'http://mock.test';
const SEDE = '11111111-1111-4111-8111-111111111111';
const socios = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nombre: 'Socio', apellido: 'Uno', desde: '2020-01-01', hasta: '2035-01-01' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', nombre: 'Socio', apellido: 'Dos', desde: '2020-01-01', hasta: '2035-01-01' },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', nombre: 'Socio', apellido: 'Tres', desde: '2020-01-01', hasta: '2035-01-01' },
];
const recepcionista = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', nombre: 'Recep', apellido: 'Uno', tipoActor: 'RECEPCIONISTA', sedeId: SEDE };

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = publicKey.export({ format: 'jwk' });
const clave = { kid: 'repro-1', alg: 'ES256', jwk };
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function qr(usuarioId) {
  const ahora = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: clave.kid, typ: 'JWT' });
  const p = b64({ tipo: 'qr-acceso', usuarioId, jti: crypto.randomUUID(), iat: ahora, exp: ahora + 60 });
  const f = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${p}.${f}`;
}

(async () => {
  const dentro = new Set();
  let offline = false;
  const log = [];
  const nota = (t) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${t}`; log.push(l); console.log(l); };
  const t0 = Date.now();
  const desconocidos = new Set();

  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const { defaultBrowserType, ...movil } = devices['iPhone 13'];
  const context = await browser.newContext({ ...movil, baseURL: BASE, permissions: ['camera'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => nota(`PAGEERROR: ${e.message}\n${e.stack ?? ''}`));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) nota(`CONSOLE ${m.type()}: ${m.text()}`); });
  page.on('crash', () => nota('CRASH de la pestaña'));

  const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (offline) return route.abort('internetdisconnected');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(req.url());
    const json = (data, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const p = u.pathname;
    if (p === '/auth/me') return json(recepcionista);
    if (p === '/acceso/clave-publica') return json(clave);
    if (p.startsWith('/acceso/snapshot/')) {
      const ahora = new Date();
      return json({
        sedeId: SEDE, generadoEn: ahora.toISOString(), venceEn: new Date(+ahora + 864e5).toISOString(), clave,
        aforo: { actual: dentro.size, maximo: 30 }, dentro: [...dentro], socios,
      });
    }
    if (p.startsWith('/acceso/aforo/')) return json({ actual: dentro.size, maximo: 30 });
    if (p.startsWith('/acceso/dentro/')) {
      const data = [...dentro].map((id) => { const s = socios.find((x) => x.id === id); return { id: `s-${id}`, horaIngreso: new Date().toISOString(), usuario: { id, nombre: s.nombre, apellido: s.apellido } }; });
      return json({ data, total: data.length, page: 1, limit: 4 });
    }
    if (p.startsWith('/sedes/')) return json({ id: SEDE, nombre: 'FitZone Central', direccion: 'x', aforoMaximo: 30, activa: true });
    if (p === '/acceso/validar') { const b = req.postDataJSON(); const uid = JSON.parse(Buffer.from(b.qrToken.split('.')[1], 'base64url').toString()).usuarioId; dentro.add(uid); const s = socios.find((x) => x.id === uid); return json({ id: 'x', horaIngreso: new Date().toISOString(), usuario: { id: uid, nombre: s.nombre, apellido: s.apellido } }); }
    if (p === '/acceso/sincronizar') {
      const body = req.postDataJSON();
      await new Promise((r) => setTimeout(r, 400));
      const resultados = body.eventos.map((e) => {
        const uid = JSON.parse(Buffer.from(e.qrToken.split('.')[1], 'base64url').toString()).usuarioId;
        dentro.add(uid);
        return { clientEventId: e.clientEventId, estado: 'CREADO', codigo: 'OK', accesoId: crypto.randomUUID() };
      });
      return json({ resultados });
    }
    desconocidos.add(`${req.method()} ${p}`);
    return json([]);
  });

  const estado = async (etiqueta) => {
    const info = await page.evaluate(() => {
      const root = document.getElementById('root');
      return { texto: (root?.innerText ?? '').trim().length, hijos: root?.children.length ?? 0, online: navigator.onLine };
    }).catch((e) => ({ error: String(e) }));
    nota(`${etiqueta}: ${JSON.stringify(info)}`);
    await page.screenshot({ path: path.join(OUT, `${String(log.length).padStart(3, '0')}-${etiqueta.replace(/\W+/g, '-')}.png`) });
    return info;
  };
  const cortar = async (t) => { offline = true; await context.setOffline(true); nota(`-- RED CORTADA (${t})`); await page.waitForTimeout(800); await estado(`cortada ${t}`); };
  const volver = async (t) => {
    offline = false; await context.setOffline(false); nota(`-- RED RESTABLECIDA (${t})`);
    if (process.env.EVENTOS_IOS) await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  };
  const ingresar = async (socio, t) => {
    await page.getByRole('tab', { name: 'Pegado' }).click();
    await page.getByPlaceholder('Pegá el qrToken aquí').fill(qr(socio.id));
    await page.getByRole('button', { name: /Validar ingreso/ }).click();
    await page.getByText(/Ingreso permitido|ya figura|no es válido|venció/).first().waitFor({ timeout: 8000 });
    await estado(`ingreso ${t}`);
  };

  const ingresarOnline = async (socio) => {
    dentro.delete(socio.id);
    await page.getByRole('tab', { name: 'Pegado' }).click();
    await page.getByPlaceholder('Pegá el qrToken aquí').fill(qr(socio.id));
    await page.getByRole('button', { name: /Validar ingreso/ }).click();
    await page.waitForTimeout(1500);
    await estado('ingreso online');
  };

  await page.goto('/admin/acceso');
  await page.getByText('Validar ingreso').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await estado('inicio');

  if (process.env.ARRANQUE_SIN_API) {
    // La app se abre sin poder consultar a /auth/me (servidor inalcanzable): sesión sin verificar.
    for (const ciclo of [1, 2]) {
      offline = true; nota(`-- API INALCANZABLE y recarga (ciclo ${ciclo})`);
      await page.reload(); await page.waitForTimeout(2500); await estado(`recargada sin API ciclo ${ciclo}`);
      await ingresar(socios[ciclo - 1], `sin API ciclo ${ciclo}`);
      offline = false; nota(`-- API DE VUELTA (ciclo ${ciclo})`);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      for (const espera of [500, 1500, 3000, 6000]) { await page.waitForTimeout(espera); await estado(`api de vuelta ciclo ${ciclo} +${espera}ms`); }
    }
    if (desconocidos.size) nota(`Endpoints sin mock: ${[...desconocidos].join(', ')}`);
    fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
    await browser.close();
    return;
  }

  for (const ciclo of [1, 2]) {
    if (process.env.CON_CAMARA) { await page.getByRole('tab', { name: 'Cámara' }).click(); await page.waitForTimeout(1500); await estado(`camara abierta ciclo ${ciclo}`); }
    await cortar(`ciclo ${ciclo}`);
    await ingresar(socios[ciclo - 1], `ciclo ${ciclo}`);
    await volver(`ciclo ${ciclo}`);
    if (process.env.VALIDAR_ONLINE && ciclo === 1) { await page.waitForTimeout(2500); await ingresarOnline(socios[2]); }
    for (const espera of [500, 1500, 3000, 6000]) {
      await page.waitForTimeout(espera);
      await estado(`reconectada ciclo ${ciclo} +${espera}ms`);
    }
  }
  // tercer corte, por si hace falta otra vuelta
  await cortar('ciclo 3');
  await ingresar(socios[2], 'ciclo 3');
  await volver('ciclo 3');
  await page.waitForTimeout(4000);
  const fin = await estado('final');

  if (desconocidos.size) nota(`Endpoints sin mock: ${[...desconocidos].join(', ')}`);
  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  await browser.close();
  console.log(fin.texto === 0 || fin.hijos === 0 ? 'RESULTADO: PANTALLA EN BLANCO' : 'RESULTADO: la pantalla conserva contenido');
})().catch((e) => { console.error('FALLÓ EL SCRIPT:', e); process.exit(1); });
