#!/usr/bin/env node
// Genera docs/entregables/PROGV-2026-TIF-Equipo08-Dossier.pdf (Anexo A de los lineamientos).
//
// Uso (desde la raíz del repositorio):   node scripts/build-dossier/build-dossier.mjs
//
// Requisitos: Node 20 o superior, Microsoft Edge o Google Chrome (para imprimir a PDF) y
// `pdftotext` (para calcular los números de página del índice). No instala nada.
// El hash del commit sale de `git rev-parse HEAD` en el momento de generar el PDF: para la
// entrega, regenerar el PDF el 18/11 antes de crear el tag v1.0-entrega.
//
// Variables opcionales: EDGE_PATH (ruta al navegador), PDFTOTEXT_PATH.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Contexto, markdown, seccion, leerXlsx, esc, inline } from './lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const DOCS = path.join(RAIZ, 'docs');
const SALIDA = path.join(DOCS, 'entregables', 'PROGV-2026-TIF-Equipo08-Dossier.pdf');

// ---------------------------------------------------------------- datos fijos del Dossier
const ENTREGA = '19/11/2026';
const TAG = 'v1.0-entrega';
// Cifras de pruebas y cobertura (README del repositorio, sección 6; verificadas con
// `npm run test:cov` en backend/ y `npm test` en frontend/). Actualizar si cambian.
const PRUEBAS = {
  backend: 848,
  suitesBackend: 42,
  frontend: 153,
  archivosFrontend: 7,
  integracion: 18,
  suitesIntegracion: 5,
  cobertura: { sentencias: '73,65', ramas: '64,30', funciones: '58,99', lineas: '73,88' },
};
const INTEGRANTES = [
  ['Zanandrea, Martín', 'P1 (Arquitecto / Backend Lead); asume también el rol P2 (Backend Developer)', 'Martinzanandrea'],
  ['Ava, Teo', 'P3 (Frontend Developer)', 'Teo'],
  ['Retamoso, Máximo', 'P4 (QA / DevOps / Mobile)', 'maxi'],
];

// ---------------------------------------------------------------- utilidades
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} falló: ${r.stderr}`);
  return r.stdout.trim();
};
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinNumero = (md) => md.replace(/^(#+\s+)\d+(\.\d+)*\.?\s+/gm, '$1');

function buscarEjecutable(candidatos, env) {
  if (env && process.env[env] && fs.existsSync(process.env[env])) return process.env[env];
  return candidatos.find((c) => fs.existsSync(c));
}
const EDGE = buscarEjecutable(
  [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  'EDGE_PATH',
);
const PDFTOTEXT =
  buscarEjecutable(['C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe', 'C:\\msys64\\mingw64\\bin\\pdftotext.exe'], 'PDFTOTEXT_PATH') ||
  'pdftotext';

// ---------------------------------------------------------------- figuras
function figuraDiagrama(ctx, archivo, titulo, comentario = '') {
  const png = path.join(DOCS, 'diagramas', `${archivo}.png`);
  if (!fs.existsSync(png)) throw new Error(`Falta la imagen ${png}`);
  const mmd = fs.readFileSync(path.join(DOCS, 'diagramas', `${archivo}.mmd`), 'utf8');
  const enc = mmd.match(/^%% FitZone Sports · (.+?) · (\d{4}-\d{2}-\d{2}) · (v[\d.]+)/m);
  const autor = enc ? `${enc[1]}, ${enc[2].split('-').reverse().join('/')}, ${enc[3]}` : 'Equipo 08';
  const nota =
    `Elaboración del Equipo 08 (${esc(autor)}) con Mermaid. Fuente editable: <code>docs/diagramas/${archivo}.mmd</code>. ` +
    `La imagen se incluye en su resolución original y puede ampliarse en el visor del PDF.` +
    (comentario ? ' ' + comentario : '');
  return ctx.figura(titulo, pathToFileURL(png).href, nota);
}
const P = (t) => `<p>${t}</p>\n`;

// ---------------------------------------------------------------- documento
function construir(paginas) {
  const ctx = new Contexto();
  const hash = git('rev-parse', 'HEAD');
  const repo = git('remote', 'get-url', 'origin').replace(/\.git$/, '');
  const h1 = (t) => ctx.encabezado(1, t);
  const h2 = (t) => ctx.encabezado(2, t);
  const h3 = (t) => ctx.encabezado(3, t);
  let cuerpo = '';

  // 1. Resumen ejecutivo (una página)
  cuerpo += h1('1. Resumen ejecutivo del sistema');
  cuerpo += P(
    'FitZone Sports es la plataforma de gestión de una cadena de gimnasios con más de 25 sedes, planteada como caso del Trabajo Integrador Final de Programación V (Universidad Nacional de Entre Ríos [UNER], 2026a). Los socios contratan su membresía, ingresan a cualquier sede con un código QR que cambia cada minuto, reservan clases grupales y alquilan canchas de paddle y fútbol 5. El personal de cada sede valida ingresos, controla el aforo y cobra en el mostrador, y la gerencia administra sedes, precios y reportes consolidados.',
  );
  cuerpo += P(
    'El sistema es un monolito modular NestJS con TypeORM sobre PostgreSQL, con un cliente React instalable como PWA que funciona como portal del socio y consola de administración. Las reglas críticas se garantizan en la base de datos: no hay sobreventa de canchas (RN-02) ni dos sesiones de acceso abiertas para un mismo socio (RN-01). El control de acceso sigue operando sin conexión mediante QR firmados con ES256, una réplica local y una cola de ingresos que se concilia al reconectar (RNF-01). Los pagos usan una pasarela simulada que conserva solo el token (RNF-02).',
  );
  cuerpo += P(
    `La calidad se respalda con ${PRUEBAS.backend} pruebas unitarias en el backend (${PRUEBAS.cobertura.sentencias} % de sentencias cubiertas), ${PRUEBAS.frontend} en el frontend, ${PRUEBAS.integracion} de integración contra PostgreSQL y un pipeline de integración continua. La documentación reúne 23 ADR, diagramas C4, UML y DER, tres manuales y las bitácoras de los tres integrantes del Equipo 08.`,
  );

  // 2. Arquitectura
  cuerpo += h1('2. Arquitectura: diagramas C4 de los niveles 1, 2 y 3');
  cuerpo += P(
    'La arquitectura se describe con el modelo C4 (Brown, s. f.): el nivel 1 muestra el sistema y su entorno, el nivel 2 los contenedores que lo componen y el nivel 3 los componentes de dos módulos representativos. El estilo elegido es un monolito modular (ADR-001), de modo que una transacción local resuelve las reglas RN-01 y RN-02 sin coordinar servicios.',
  );
  cuerpo += h2('2.1 Nivel 1: contexto del sistema');
  cuerpo += P('El sistema interactúa con el socio, el cliente externo, el personal de recepción y gerencia de sede, la gerencia general, una pasarela de pago simulada y el proveedor de correo Brevo.');
  cuerpo += figuraDiagrama(ctx, 'c4-1-contexto', 'C4 nivel 1: contexto de FitZone Sports');
  cuerpo += h2('2.2 Nivel 2: contenedores');
  cuerpo += P('Dos aplicaciones React PWA (el terminal de recepción, con instantánea y cola locales en IndexedDB, y el portal con la consola) consumen la API REST NestJS por HTTPS. La API accede a PostgreSQL por SQL con TypeORM y a un almacén de archivos (Supabase Storage o disco local).');
  cuerpo += figuraDiagrama(ctx, 'c4-2-contenedores', 'C4 nivel 2: contenedores');
  cuerpo += h2('2.3 Nivel 3: componentes');
  cuerpo += P('Se detallan dos módulos: Canchas, donde se concentra la regla de precio y la reserva sin sobreventa, y Acceso, que sostiene el ingreso por QR sin conexión.');
  cuerpo += figuraDiagrama(ctx, 'c4-3-componentes-canchas', 'C4 nivel 3: componentes del módulo de Canchas');
  cuerpo += figuraDiagrama(ctx, 'c4-3-componentes-acceso', 'C4 nivel 3: componentes del módulo de Acceso');

  // 3. ADR
  cuerpo += h1('3. Registros de decisión arquitectónica: ADR-001 a ADR-023');
  cuerpo += P(
    'Cada decisión se documentó con la plantilla del Anexo B de los lineamientos (UNER, 2026b), que sigue la propuesta de registros de decisión de Nygard (2011): estado, fecha, autor, sprint, contexto, alternativas consideradas, decisión, consecuencias y requisitos relacionados. Un ADR no se corrige, se supera. Los ADR-001 a ADR-010 son los obligatorios; los ADR-011 a ADR-023 son decisiones propias del desarrollo.',
  );
  cuerpo += h2('Índice de decisiones');
  cuerpo += markdown(
    seccion(leer('docs/adr/README.md'), /^## Obligatorios/),
    ctx,
    { desplazar: 1, contexto: 'ADR' },
  );
  const adrs = fs.readdirSync(path.join(DOCS, 'adr')).filter((f) => /^ADR-\d{3}-/.test(f)).sort();
  if (adrs.length !== 23) throw new Error(`Se esperaban 23 ADR y hay ${adrs.length}`);
  for (const f of adrs) {
    const md = leer(`docs/adr/${f}`);
    cuerpo += markdown(md, ctx, { desplazar: 1, contexto: f.slice(0, 7) });
  }

  // 4. Modelado
  cuerpo += h1('4. Modelado: clases, secuencia, estados, actividad, DER y despliegue');
  cuerpo += P('Los diagramas se mantienen como fuente Mermaid en el repositorio y se exportan a SVG y PNG; las imágenes de este capítulo son las exportaciones vigentes.');
  cuerpo += h2('4.1 Diagrama de clases');
  cuerpo += P('El diagrama muestra las clases del dominio y sus relaciones. Las reglas de negocio se apoyan en estos tipos y en las restricciones de la base de datos.');
  cuerpo += figuraDiagrama(ctx, 'uml-clases-dominio', 'Diagrama de clases del dominio');
  cuerpo += h2('4.2 Diagramas de secuencia');
  cuerpo += P('Tres secuencias describen los recorridos más críticos: la reserva con pago, la reserva concurrente de una misma cancha (RN-02) y el ingreso por QR sin conexión (RNF-01).');
  cuerpo += figuraDiagrama(ctx, 'uml-secuencia-reserva-pago', 'Secuencia: reserva y pago');
  cuerpo += figuraDiagrama(ctx, 'uml-secuencia-reserva-concurrente', 'Secuencia: reserva concurrente (RN-02)');
  cuerpo += figuraDiagrama(ctx, 'uml-secuencia-acceso-offline', 'Secuencia: ingreso con QR sin conexión (RNF-01)', 'El diagrama asume una clave ES256 configurada y un snapshot vigente.');
  cuerpo += h2('4.3 Diagramas de estados');
  cuerpo += P('El flujo de reserva de cancha persiste los estados CONFIRMADA y CANCELADA y modela el pago por separado; la reserva de clase incorpora además la lista de espera.');
  cuerpo += figuraDiagrama(ctx, 'uml-estados-membresia', 'Estados de la membresía');
  cuerpo += figuraDiagrama(ctx, 'uml-estados-reserva', 'Estados de la reserva');
  cuerpo += h2('4.4 Diagrama de actividad');
  cuerpo += P('La actividad describe cómo se promueve a un socio desde la lista de espera cuando se libera un cupo de clase.');
  cuerpo += figuraDiagrama(ctx, 'uml-actividad-lista-espera', 'Actividad: lista de espera de clases');
  cuerpo += h2('4.5 Diagrama entidad-relación (DER)');
  cuerpo += P('El mapa general funciona como índice del modelo físico. Las cuatro vistas de detalle conservan columnas, claves e índices; las tablas de referencia se repiten con su clave cuando una relación cruza de vista. Las restricciones que sostienen las reglas de negocio son uq_cancha_horario_confirmado (RN-02), uq_acceso_abierto_por_usuario (RN-01) y uq_evento_offline_jti (detección de QR repetidos en la conciliación).');
  cuerpo += figuraDiagrama(ctx, 'der-fisico', 'DER físico: mapa general');
  cuerpo += figuraDiagrama(ctx, 'der-acceso', 'DER físico: sedes, socios y acceso');
  cuerpo += figuraDiagrama(ctx, 'der-canchas-pagos', 'DER físico: canchas y pagos');
  cuerpo += figuraDiagrama(ctx, 'der-clases', 'DER físico: clases y reservas');
  cuerpo += figuraDiagrama(ctx, 'der-auditoria-avisos', 'DER físico: auditoría y avisos');
  cuerpo += h2('4.6 Diagrama de despliegue');
  cuerpo += P('El despliegue muestra los nodos de ejecución y la ruta desde el repositorio hasta producción.');
  cuerpo += figuraDiagrama(ctx, 'despliegue', 'Diagrama de despliegue');

  // 5. Patrones
  const mt = leer('docs/manuales/manual-tecnico.md');
  const patron = (desde, hasta) => markdown(sinNumero(seccion(mt, desde, hasta)), ctx, { desplazar: -1, contexto: 'Patrones' });
  cuerpo += h1('5. Patrones de diseño aplicados y su justificación');
  cuerpo += P(
    'Los patrones se aplicaron donde resuelven un problema concreto del dominio, no por decoración (Gamma et al., 1994). Los tres patrones de comportamiento y persistencia exigidos por la unidad (Strategy, Observer y Repository) se describen con su ubicación en el código y la razón de su elección; los restantes se resumen en una tabla.',
  );
  cuerpo += patron(/^### 4\.1 /, /^### 4\.2 /);
  cuerpo += P('Justificación. Las reglas de precio (descuento de socio y recargo de hora pico) cambian con el negocio y se combinan entre sí. Encapsular cada una en una estrategia evita condicionales en el servicio de reservas y permite sumar una regla nueva registrándola como proveedor, sin modificar el calculador; el manual técnico lo demuestra con el caso resuelto de agregar una estrategia de precio.');
  cuerpo += patron(/^### 4\.2 /, /^### 4\.3 /);
  cuerpo += P('Justificación. Cancelar una reserva debe liberar un cupo y promover al primero de la lista de espera, pero el servicio de reservas no debe conocer esa consecuencia. El evento desacopla ambos lados: agregar otra reacción es agregar otro listener, sin tocar el servicio.');
  cuerpo += patron(/^### 4\.3 /, /^### 4\.4 /);
  cuerpo += P('Justificación. La interfaz aísla la persistencia: la implementación de TypeORM encapsula la transacción y el bloqueo que garantizan RN-02 (ADR-004), y la implementación en memoria permite probar los servicios sin base de datos, en línea con la pirámide de pruebas del ADR-008.');
  cuerpo += patron(/^### 4\.4 /, /^## 5\. /);
  cuerpo += P('Justificación. Factory, Adapter y Decorator aparecen donde el sistema depende de piezas intercambiables (proveedores de correo, almacenamiento, pasarela) o de comportamiento transversal (auditoría y roles); Facade ordena el flujo de reserva en un único punto de entrada; State concentra las reglas que dependen del estado de la membresía.');

  // 6. Pruebas
  const c = PRUEBAS.cobertura;
  cuerpo += h1('6. Estrategia de pruebas y reporte de cobertura');
  cuerpo += P('La estrategia sigue una pirámide de pruebas con umbral de cobertura declarado en el ADR-008 y verificado por el pipeline: pruebas unitarias con dobles en memoria, pruebas de integración contra PostgreSQL real para las reglas que dependen de la concurrencia y verificación del sistema completo con Docker.');
  cuerpo += h2('6.1 Niveles de prueba y resultados');
  cuerpo += ctx.tablaApa(
    'Niveles de prueba y resultados',
    ['Nivel', 'Comando', 'Resultado'],
    [
      ['Unitarias del backend', '<code>npm test</code> (en <code>backend/</code>)', `${PRUEBAS.backend} pruebas en ${PRUEBAS.suitesBackend} suites, todas en verde`],
      ['Unitarias del frontend', '<code>npm test</code> (en <code>frontend/</code>)', `${PRUEBAS.frontend} pruebas en ${PRUEBAS.archivosFrontend} archivos, todas en verde`],
      ['Integración contra PostgreSQL (RN-01, RN-02, cupo de clases, sincronización offline)', '<code>npm run test:integracion</code> (en <code>backend/</code>)', `${PRUEBAS.integracion} pruebas en ${PRUEBAS.suitesIntegracion} suites. Requieren una base PostgreSQL; las corre el job <code>integracion</code> del CI`],
      ['Sistema', 'job <code>docker</code> del CI', 'Levanta con <code>docker compose up --build</code> y responde en el CI'],
    ],
    { nota: 'Fuente: README del repositorio, sección 6, y <code>docs/manuales/manual-tecnico.md</code>, sección 8.' },
  );
  cuerpo += h2('6.2 Cobertura del backend');
  cuerpo += P(`La cobertura de las pruebas unitarias del backend se obtuvo con <code>npm run test:cov</code>. Las cuatro métricas superan el umbral mínimo declarado en el ADR-008 y configurado en <code>coverageThreshold</code>; si el resultado queda por debajo, el comando falla y el CI bloquea el merge. El frontend no tiene umbral ni informe de cobertura.`);
  cuerpo += ctx.tablaApa(
    'Cobertura de las pruebas unitarias del backend',
    ['Métrica', 'Obtenido (%)', 'Umbral (%)', 'Cumple'],
    [
      ['Sentencias', c.sentencias, '70', 'Sí'],
      ['Ramas', c.ramas, '60', 'Sí'],
      ['Funciones', c.funciones, '55', 'Sí'],
      ['Líneas', c.lineas, '70', 'Sí'],
    ],
    { nota: 'Informe detallado: <code>backend/coverage/lcov-report/index.html</code>, generado por <code>npm run test:cov</code>.' },
  );
  cuerpo += h2('6.3 Pipeline de integración y entrega continuas');
  cuerpo += markdown(sinNumero(seccion(mt, /^## 9\. /, /^## 10\. /)).replace(/^## .*\n/, ''), ctx, { desplazar: 0, contexto: 'Jobs del pipeline de integración continua' });
  cuerpo += figuraDiagrama(ctx, 'pipeline', 'Pipeline de integración continua');
  cuerpo += h2('6.4 Otros informes de pruebas');
  cuerpo += P('El repositorio conserva, además, el reporte de QA del sprint 5 (<code>docs/PRUEBAS.md</code>), con pruebas de uso, de seguridad y de casos simultáneos realizadas sobre producción, y el informe de auditoría de testing del 29/10/2026 (<code>docs/testing/informe-auditoria-testing.md</code>), que documenta el estado previo a las pruebas de integración y al pipeline.');

  // 7. RNF
  const indices = fs
    .readdirSync(path.join(RAIZ, 'backend', 'db', 'sql'))
    .filter((f) => f.endsWith('.sql'))
    .reduce((n, f) => n + (fs.readFileSync(path.join(RAIZ, 'backend', 'db', 'sql', f), 'utf8').match(/CREATE\s+(UNIQUE\s+)?INDEX/gi) || []).length, 0);
  cuerpo += h1('7. Cumplimiento de los requisitos no funcionales y su evidencia');
  cuerpo += P('Los cuatro requisitos no funcionales (RNF-01 a RNF-04) del enunciado (UNER, 2026a) se tradujeron en decisiones de arquitectura. La tabla resume cada requisito, cómo se cumple y dónde está la evidencia; el apartado siguiente transcribe el único informe que hoy existe en <code>docs/rnf</code>.');
  cuerpo += ctx.tablaApa(
    'Cumplimiento de los requisitos no funcionales',
    ['RNF', 'Requisito (según los ADR)', 'Cómo se cumple', 'Evidencia en el repositorio'],
    [
      ['RNF-01', 'El control de acceso funciona aunque se caiga la conexión principal (disponibilidad de 99,5 %). ADR-003.', 'QR firmado con ES256, réplica local de socios en el terminal, cola de ingresos y conciliación al reconectar (ADR-003, ADR-007).', '<code>acceso-offline.spec.ts</code> y <code>acceso-sincronizacion.spec.ts</code>; pruebas de integración de la sincronización; manual técnico, sección 6. La prueba de punta a punta en producción figura como pendiente (FT1-130).'],
      ['RNF-02', 'No se almacenan datos de tarjeta, solo el token de la pasarela. ADR-010.', 'Pasarela simulada que devuelve un token; ninguna entidad tiene campos de tarjeta.', '<code>pagos/gateway/pasarela-mock.service.ts</code>; <code>pagos/pasarela-cancha.spec.ts</code>.'],
      ['RNF-03', 'La consulta de disponibilidad de canchas responde en milisegundos. ADR-002.', `Índices del esquema SQL, entre ellos <code>idx_reservas_cancha_disponibilidad</code> para la grilla de canchas.`, `${indices} sentencias <code>CREATE INDEX</code> en <code>backend/db/sql</code>. El repositorio no contiene una medición de tiempos de respuesta.`],
      ['RNF-04', 'Se puede dar de alta una sede nueva sin detener el sistema. ADR-001.', 'Las sedes son datos: se crean por API (<code>POST /sedes</code>) o desde la consola, sin reiniciar ni desplegar.', 'Manual de instalación y operación, sección 9; datos de prueba con 25 sedes.'],
    ],
    { clase: 'densa', nowrap: [0], nota: 'Elaboración propia a partir de los ADR, el manual técnico y el código del repositorio.' },
  );
  cuerpo += h2('7.1 Evidencia disponible en docs/rnf');
  cuerpo += P('La carpeta <code>docs/rnf</code> contiene un único informe: el escaneo de secretos sobre el historial completo del repositorio, que respalda la condición de admisibilidad de no versionar credenciales. Se transcribe a continuación.');
  cuerpo += markdown(leer('docs/rnf/escaneo-secretos.md'), ctx, { desplazar: 2, contexto: 'Escaneo de secretos' });
  cuerpo += h2('7.2 Evidencia pendiente');
  cuerpo += P('El tablero de Jira mantiene la tarjeta FT1-117, «Evidencia de requisitos no funcionales en docs/rnf», en estado «Por hacer». Por ese motivo <code>docs/rnf</code> no incluye todavía mediciones de disponibilidad (RNF-01) ni de tiempo de respuesta (RNF-03), y la evidencia de la tabla anterior se apoya en las decisiones de arquitectura, el código y las pruebas.');

  // 8. Planificación
  cuerpo += h1('8. Planificación: plan, cronograma, trazabilidad, seguimiento y riesgos');
  cuerpo += P('Se incorpora el plan de proyecto completo (<code>docs/planificacion/PLANIFICACION.md</code>), elaborado a partir de la exportación del tablero de Jira y del historial del repositorio. Sus secciones cubren alcance, supuestos, equipo, estructura de desglose del trabajo, cronograma, asignación, matriz de trazabilidad, seguimiento por sprint, riesgos y análisis de desvíos.');
  const plan = leer('docs/planificacion/PLANIFICACION.md').split(/^## 11\. Referencias/m)[0];
  cuerpo += markdown(plan, ctx, { desplazar: 1, contexto: 'Planificación' });

  // 9. Bitácoras
  cuerpo += h1('9. Bitácoras individuales de los integrantes');
  cuerpo += P('Cada integrante lleva una bitácora con la plantilla del Anexo C de los lineamientos (UNER, 2026b). Los hashes, fechas y mensajes provienen del historial de git; las horas son estimaciones, con la regla de cálculo declarada en cada bitácora.');
  for (const f of ['LOG-zanandrea', 'LOG-ava', 'LOG-retamoso']) {
    cuerpo += markdown(leer(`docs/bitacoras/${f}.md`), ctx, { desplazar: 1, contexto: f });
  }

  // 10. Manuales
  cuerpo += h1('10. Índice de los manuales entregados y su ubicación en el repositorio');
  cuerpo += P('Los manuales no se copian en este Dossier: se entregan en el repositorio, en la carpeta <code>docs/manuales</code>, dentro del tag ' + `<code>${TAG}</code>. Las capturas del manual de usuario están en <code>docs/manuales/img</code>.`);
  const manuales = [
    ['Manual de usuario', 'Socio, cliente externo, recepcionista y gerentes', 'docs/manuales/manual-de-usuario.md', 'Anexo D'],
    ['Manual de instalación y operación', 'Quien instala, despliega y opera el sistema', 'docs/manuales/manual-de-instalacion-y-operacion.md', 'Anexo E'],
    ['Manual técnico', 'Desarrolladores que mantienen o extienden el sistema', 'docs/manuales/manual-tecnico.md', 'Anexo F'],
  ];
  cuerpo += ctx.tablaApa(
    'Manuales entregados',
    ['Manual', 'Destinatario', 'Ubicación en el repositorio', 'Índice según'],
    manuales.map(([n, d, u, a]) => [n, d, `<code>${u}</code>`, `${a} de los lineamientos`]),
    { nota: 'Los índices de cada manual se transcriben a continuación desde sus encabezados.' },
  );
  for (const [nombre, , ubic] of manuales) {
    const md = leer(ubic);
    const meta = (md.match(/^\*\*Versión:\*\*.*$/m) || [''])[0];
    const secciones = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].replace(/`/g, ''));
    cuerpo += h2(nombre);
    if (meta) cuerpo += P(inline(meta));
    cuerpo += `<ol class="indice-manual" style="list-style:none;padding-left:1.27cm">${secciones.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>\n`;
  }

  // 11. Tablero
  cuerpo += h1('11. Anexo: tablero del proyecto exportado');
  const xlsx = leerXlsx(fs.readFileSync(path.join(DOCS, 'entregables', 'PROGV-2026-TIF-Equipo08-Registro.xlsx')));
  const hoja = (n) => xlsx.find((h) => h.nombre === n);
  const tarjetas = hoja('Tarjetas'), sprints = hoja('Sprints'), resumen = hoja('Resumen'), nota = hoja('Nota de transparencia');
  if (!tarjetas || !sprints || !resumen || !nota) throw new Error('El xlsx no tiene las hojas esperadas');
  cuerpo += P('El archivo <code>docs/entregables/PROGV-2026-TIF-Equipo08-Registro.xlsx</code> contiene el tablero FT1 exportado de Jira. Se reproducen sus hojas como tablas, comenzando por la nota de transparencia que acompaña a la exportación.');
  cuerpo += h2('11.1 Nota de transparencia');
  cuerpo += `<p class="sin-sangria"><strong>${esc(nota.filas[0][0])}</strong></p>\n`;
  for (const f of nota.filas.slice(1)) if (f[0]) cuerpo += P(esc(f[0]));
  const tabla = (h, titulo, clase = '', notaTxt = '', nowrap = []) => {
    const [cab, ...filas] = h.filas;
    return ctx.tablaApa(titulo, cab.map(esc), filas.filter((f) => f.some((x) => x)).map((f) => cab.map((_, k) => esc(f[k] ?? ''))), { clase, nota: notaTxt, nowrap });
  };
  cuerpo += h2('11.2 Resumen por responsable');
  cuerpo += `<p class="sin-sangria">${esc(resumen.filas[0][0])}.</p>
`;
  // La hoja Resumen contiene varios bloques separados por filas vacías; cada uno se vuelve una tabla.
  const bloques = [];
  let actual = [];
  for (const f of resumen.filas.slice(1)) {
    if (f.every((x) => !x)) { if (actual.length) bloques.push(actual); actual = []; } else actual.push(f);
  }
  if (actual.length) bloques.push(actual);
  const titulosResumen = ['Tarjetas por responsable y estado', 'Fecha de creación de las tarjetas'];
  bloques.forEach((b, i) => {
    cuerpo += tabla({ filas: b }, titulosResumen[i] ?? `Resumen del tablero (${i + 1})`, '', i === 0 ? 'Valores calculados en la hoja Resumen del archivo, con fórmulas sobre la hoja Tarjetas.' : '', [0]);
  });
  cuerpo += h2('11.3 Sprints');
  cuerpo += tabla(sprints, 'Sprints del tablero FT1', 'densa', 'Hoja Sprints del archivo exportado.', [0, 2, 3, 4, 5, 7]);
  cuerpo += h2('11.4 Tarjetas');
  cuerpo += tabla(tarjetas, `Tarjetas del tablero FT1 (${tarjetas.filas.length - 1})`, 'densa', 'Hoja Tarjetas del archivo exportado; las fechas están en hora de Argentina.', [0, 1, 4, 6]);

  // Referencias
  cuerpo += h1('Referencias');
  const refs = [
    'Brown, S. (s. f.). <em>The C4 model for visualizing software architecture</em>. https://c4model.com',
    'Equipo 08. (2026). <em>Tablero FT1 FitZoneSports1</em> [Registro de proyecto]. Jira. https://fitzone-sports.atlassian.net',
    'Gamma, E., Helm, R., Johnson, R. y Vlissides, J. (1994). <em>Design patterns: Elements of reusable object-oriented software</em>. Addison-Wesley.',
    'Meta Platforms, Inc. (s. f.). <em>React documentation</em>. https://react.dev',
    'NestJS. (s. f.). <em>NestJS documentation</em>. https://docs.nestjs.com',
    'Nygard, M. (2011, 15 de noviembre). <em>Documenting architecture decisions</em>. Cognitect. https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions',
    'PostgreSQL Global Development Group. (s. f.). <em>PostgreSQL 17 documentation</em>. https://www.postgresql.org/docs/17/',
    'TypeORM. (s. f.). <em>TypeORM documentation</em>. https://typeorm.io',
    'Universidad Nacional de Entre Ríos, Facultad de Ciencias de la Administración. (2026a). <em>Trabajo integrador final: Caso FitZone Sports</em> [Enunciado]. Programación V.',
    'Universidad Nacional de Entre Ríos, Facultad de Ciencias de la Administración. (2026b). <em>Lineamientos de entrega del TIF FitZone Sports, 2.º cuatrimestre 2026</em> [Documento de cátedra]. Programación V.',
    'Vite. (s. f.). <em>Vite documentation</em>. https://vite.dev/guide/',
  ];
  cuerpo += `<div class="ref">${refs.map((r) => `<p>${r}</p>`).join('\n')}</div>\n`;

  // Citas de las tecnologías (en la sección 2, donde corresponde al stack)
  cuerpo = cuerpo.replace(
    'El estilo elegido es un monolito modular (ADR-001)',
    'La pila tecnológica es NestJS (s. f.) con TypeORM (s. f.) sobre PostgreSQL (PostgreSQL Global Development Group, s. f.) en el servidor, y React (Meta Platforms, Inc., s. f.) con Vite (s. f.) en el cliente. El estilo elegido es un monolito modular (ADR-001)',
  );

  // Portada
  const portada = `
<section class="portada">
<p class="titulo">Dossier del Trabajo Integrador Final: caso FitZone Sports</p>
<div class="bloque">
<p>Universidad Nacional de Entre Ríos</p>
<p>Facultad de Ciencias de la Administración</p>
<p>Licenciatura en Sistemas</p>
<p>Programación V, año 2026</p>
<p>Equipo 08</p>
</div>
<div class="tabla-apa cover"><table>
<colgroup><col style="width:22%"><col style="width:17%"><col style="width:35%"><col style="width:26%"></colgroup>
<thead><tr><th>Apellido y nombre</th><th>Legajo</th><th>Rol</th><th>Usuario de Git</th></tr></thead>
<tbody>${INTEGRANTES.map(([n, r, u]) => `<tr><td>${esc(n)}</td><td>________</td><td>${esc(r)}</td><td>${esc(u)}</td></tr>`).join('\n')}</tbody>
</table></div>
<div class="datos">
<p><strong>Fecha de entrega:</strong> ${ENTREGA}</p>
<p><strong>URL del repositorio:</strong> ${esc(repo)}</p>
<p><strong>Tag:</strong> ${TAG}</p>
<p><strong>Hash del commit:</strong> <span class="hash">${hash}</span></p>
</div>
</section>`;

  // Tabla de contenido
  const filas = ctx.toc.map((e, i) => {
    const pg = paginas ? paginas[i] : '00';
    return `<a class="fila n${e.nivel}" href="#${e.id}"><span class="tx">${esc(e.texto)}</span><span class="pt"></span><span class="pg">${pg}</span></a>`;
  });
  const toc = `<section class="toc">\n<h1 class="continuo">Tabla de contenido</h1>\n${filas.join('\n')}\n</section>\n`;

  const css = fs.readFileSync(path.join(AQUI, 'dossier.css'), 'utf8');
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Dossier del Trabajo Integrador Final: caso FitZone Sports</title>
<style>${css}</style></head>
<body>
${portada}
${toc}
${cuerpo}
</body></html>`;
  return { html, toc: ctx.toc, hash };
}

// ---------------------------------------------------------------- PDF
function imprimir(html, salida) {
  if (!EDGE) throw new Error('No se encontró Edge ni Chrome. Definir EDGE_PATH.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const htmlPath = path.join(tmp, 'dossier.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const r = spawnSync(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--user-data-dir=${path.join(tmp, 'perfil')}`,
      '--virtual-time-budget=60000',
      `--print-to-pdf=${salida}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: 'utf8', timeout: 600000 },
  );
  if (!fs.existsSync(salida)) throw new Error(`El navegador no generó el PDF.\n${r.stderr}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
function textoPorPagina(pdf) {
  const r = spawnSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('No se pudo ejecutar pdftotext (definir PDFTOTEXT_PATH).');
  const pags = r.stdout.split('\f');
  if (pags[pags.length - 1].trim() === '') pags.pop();
  return pags;
}
/** Ubica la página de cada encabezado del índice, en orden y sin confundirlo con el índice mismo. */
function ubicar(toc, pdf) {
  const pags = textoPorPagina(pdf).map((t) => t.split('\n').map(norm).filter(Boolean));
  let desde = 1;
  const res = [];
  for (const e of toc) {
    const objetivo = norm(e.texto);
    let hallada = -1;
    for (let p = desde; p < pags.length && hallada < 0; p++) {
      const ls = pags[p];
      for (let i = 0; i < ls.length && hallada < 0; i++) {
        let acum = '';
        for (let k = 0; k < 4 && i + k < ls.length; k++) {
          acum = norm(acum + ' ' + ls[i + k]);
          if (acum === objetivo) hallada = p;
          if (acum.length > objetivo.length) break;
        }
      }
    }
    if (hallada < 0) throw new Error(`No se encontró el encabezado «${e.texto}» en el PDF`);
    res.push(hallada + 1);
    desde = hallada;
  }
  return { paginas: res, total: pags.length };
}

// ---------------------------------------------------------------- main
const sucio = git('status', '--porcelain', '--', 'docs', 'backend', 'frontend');
if (sucio) console.warn('Aviso: hay cambios sin commitear en docs/, backend/ o frontend/; el hash de la portada no los incluye:\n' + sucio + '\n');

const tmpPdf = path.join(os.tmpdir(), `dossier-${process.pid}.pdf`);
let { html, toc, hash } = construir(null);
imprimir(html, tmpPdf);
let { paginas } = ubicar(toc, tmpPdf);
({ html } = construir(paginas));
imprimir(html, tmpPdf);
const verif = ubicar(toc, tmpPdf);
if (verif.paginas.some((p, i) => p !== paginas[i])) {
  paginas = verif.paginas;
  ({ html } = construir(paginas));
  imprimir(html, tmpPdf);
  const v2 = ubicar(toc, tmpPdf);
  if (v2.paginas.some((p, i) => p !== paginas[i])) throw new Error('La paginación del índice no se estabiliza');
}
fs.copyFileSync(tmpPdf, SALIDA);
fs.rmSync(tmpPdf, { force: true });
console.log(`PDF generado: ${path.relative(RAIZ, SALIDA)} (${verif.total} páginas, commit ${hash.slice(0, 12)})`);
