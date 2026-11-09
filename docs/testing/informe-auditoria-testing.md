# Informe de auditoría de testing — FitZone Sports

Fecha: 2026-10-29. Alcance: `backend/` (Jest) y `frontend/`. Solo lectura de código y ejecución de `jest`; no se modificó nada salvo este archivo.

## Resumen ejecutivo

1. `npx jest` en `backend/`: **37 suites, 648 pruebas, todas pasan** (0 skip, 0 todo).
2. Cobertura global: **71,0 % sentencias / 63,0 % ramas / 48,8 % funciones / 72,1 % líneas**. Los servicios de Acceso, Auth, Sedes, Precios, Auditoría y Reparto de horas están por debajo del 40 %.
3. **Ninguna prueba usa base de datos real**: todo es unitario con mocks o con una "base simulada" en memoria. RN01, RN02 y RN03 se prueban solo parcialmente y la concurrencia es simulada, no real.
4. Huecos de mayor riesgo: ingreso por QR (`acceso.service`), `auth.service`, alta de reserva online de cancha ante choque de horario, `precios.service`, interceptor de auditoría.
5. `frontend/` no tiene runner de pruebas y no existe `.github/workflows` (no hay CI). La prueba e2e de `backend/test` es la plantilla de Nest y no está en `npm test`.

## 1. Inventario por módulo (`backend/src`)

| Módulo | Archivo spec | Pruebas | Tipo |
|---|---|---:|---|
| (raíz) | `app.controller.spec.ts` | 1 | Unitaria (módulo Nest real, sin DB; plantilla) |
| (raíz) | `auditoria-endpoints.spec.ts` | 4 | Estructura (metadatos de decoradores de todos los controladores) |
| (raíz) | `seguridad-lecturas.spec.ts` | 28 | Unitaria con mocks (alcance por sede/dueño) |
| acceso | `acceso.controller.spec.ts` | 29 | Unitaria (roles/guards por metadatos + aforo con mocks) |
| auth | `helpers/jwt-expiracion.helper.spec.ts` | 19 | Unitaria pura |
| canchas | `canchas.service.spec.ts` | 16 | Unitaria con mocks, fechas congeladas |
| canchas | `reserva-cancha.service.spec.ts` | 16 | Unitaria con mocks |
| canchas | `reserva-cancha-turnos.spec.ts` | 8 | Unitaria con mocks |
| clases | `booking-clase.repository.spec.ts` | 9 | Unitaria (DataSource/EntityManager mockeados) |
| clases | `gestion-clases.spec.ts` | 80 | Unitaria con mocks, fechas congeladas |
| clases | `horario-argentina.spec.ts` | 10 | Unitaria, fechas congeladas |
| clases | `listeners/lista-espera.listener.spec.ts` | 8 | Unitaria con mocks |
| clases | `reserva-clase.service.spec.ts` | 11 | Unitaria con mocks |
| clases | `reservas-controllers.spec.ts` | 15 | Unitaria con mocks |
| clientes | `clientes.spec.ts` | 15 | Unitaria (DataSource con `query` mockeado) |
| common/mail | `brevo.enviador.spec.ts` | 8 | Unitaria (HTTP mockeado) |
| common/mail | `crear-enviador.spec.ts` | 10 | Unitaria (usa `process.env`) |
| database | `pool.config.spec.ts` | 9 | Unitaria pura |
| membresias | `consumidores-vigencia.spec.ts` | 10 | Unitaria con mocks (**modificado sin commit**) |
| membresias | `membresias-huerfanas.spec.ts` | 8 | Unitaria con mocks |
| membresias | `membresias.service.spec.ts` | 24 | Unitaria con mocks, fechas congeladas |
| membresias | `vigencia.spec.ts` | 22 | Unitaria, fechas congeladas |
| notificaciones | `notificaciones.spec.ts` | 71 | Unitaria con mocks |
| notificaciones | `notificaciones-extensibilidad.spec.ts` | 7 | Integración ligera: `Test.createTestingModule` con repositorios sobreescritos (sin DB) |
| notificaciones | `notificadores/email.notificador.spec.ts` | 3 | Unitaria |
| notificaciones | `notificadores/push.notificador.spec.ts` | 17 | Unitaria |
| notificaciones | `push/push.spec.ts` | 25 | Unitaria |
| pagos | `cobro-cancha-presencial.spec.ts` | 32 | Unitaria sobre **base simulada** (transacción + lock en memoria) |
| pagos | `cobro-efectivo.spec.ts` | 33 | Unitaria con mocks |
| pagos | `cobro-reserva-existente.spec.ts` | 6 | Unitaria con mocks |
| pagos | `comprobantes/comprobante-pdf.spec.ts` | 21 | Unitaria; genera PDF real en memoria (pdfkit), sin DB |
| pagos | `historial-comprobantes.spec.ts` | 23 | Unitaria con mocks |
| pagos | `pagos.service.spec.ts` | 18 | Unitaria con mocks |
| pagos | `pasarela-cancha.spec.ts` | 8 | Unitaria sobre base simulada (cola = lock) |
| usuarios | `email-verificacion.service.spec.ts` | 8 | Unitaria con mocks |
| usuarios | `usuarios-duplicados.spec.ts` | 12 | Unitaria (errores `23505` fabricados a mano) |
| usuarios | `usuarios-sede.spec.ts` | 4 | Unitaria con mocks |
| **Total** | **37 suites** | **648** | |

Módulos de `backend/src` **sin ningún spec propio**: `admin`, `auditoria` (servicio/interceptor), `auth` (servicio/controlador/estrategia), `instructores`, `precios`, `sedes`, `storage`. (`auditoria` y `precios`, `sedes`, `auth` reciben cobertura indirecta de `auditoria-endpoints` y `seguridad-lecturas`.)

Otros runners: `backend/test/app.e2e-spec.ts` (`npm run test:e2e`, config `test/jest-e2e.json`) importa `AppModule` completo y espera `GET /` → `Hello World!`. **No lo ejecuté**: levantar `AppModule` abre conexión a la base. Es la plantilla por defecto de Nest. No hay Playwright/Cypress ni otro runner en el repo.

## 2. Cobertura (Jest `--coverage`, salida de texto)

Global: **Stmts 70,98 % · Branch 63,02 % · Funcs 48,78 % · Lines 72,06 %**.

| Módulo (carpeta) | Stmts | Branch | Funcs | Lines |
|---|---:|---:|---:|---:|
| src (raíz, `main`/`app.module` en 0 %) | 22,8 | 30 | 75 | 17,6 |
| acceso | 47,2 | 45,3 | 36 | 47,3 |
| admin | 40,1 | 39,0 | 35,7 | 38,9 |
| auditoria | 43,0 | 34,5 | 27,3 | 43,7 |
| auth | 41,8 | 39,5 | 0 | 39,3 |
| auth/helpers | 73,3 | 64,4 | 100 | 73,7 |
| canchas | 64,0 | 59,9 | 51,3 | 65,5 |
| canchas/pricing | 100 | 100 | 100 | 100 |
| clases | 62,1 | 61,3 | 50,5 | 63,8 |
| clientes | 83,9 | 82,5 | 71,4 | 87,8 |
| common/helpers | 94,6 | 80,4 | 95 | 93,9 |
| common/mail | 94,0 | 85,7 | 88,9 | 93,8 |
| database | 47,4 | 100 | 60 | 50 |
| entities | 79,8 | 69,6 | 9,3 | 86,7 |
| instructores | 61,6 | 62 | 40 | 62,1 |
| membresias | 79,4 | 70,8 | 75 | 78,9 |
| notificaciones | 88,6 | 67,9 | 58,8 | 89,3 |
| notificaciones/push | 98,6 | 83,3 | 90,9 | 98,4 |
| pagos | 79,5 | 74,0 | 62,5 | 80,3 |
| pagos/comprobantes | 96,4 | 76,9 | 100 | 96,1 |
| pagos/gateway | 0 | 0 | 0 | 0 |
| precios | 48,8 | 60 | 0 | 45,9 |
| sedes | 37,3 | 38,6 | 0 | 34,5 |
| storage | 25,9 | 37,5 | 0 | 22,7 |
| usuarios | 57,4 | 48,1 | 40,5 | 57,9 |
| usuarios/interceptors | 36,4 | 0 | 0 | 22,2 |

Archivos con menor cobertura relevantes (líneas): `auditoria.interceptor.ts` 0 %, `jwt.strategy.ts` 0 %, `pasarela-mock.service.ts` 0 %, `reparto-horas.service.ts` 7 %, `tipos-cancha.service.ts` 17 %, `sedes.service.ts` 21 %, `franjas-horarias.service.ts` 22 %, `auth.service.ts` 25 %, `comprobantes.service.ts` 25 %, `supabase-storage.service.ts` 26 %, `precios.service.ts` 31 %, `auditoria.service.ts` 32 %, `admin.service.ts` 34 %, `acceso.service.ts` 35 %, `rechazar-campos-sensible.interceptor.ts` 22 %. Los `*.module.ts`, `main.ts` y `database.module.ts` están en 0 % (esperable). Las `*.in-memory.repository.ts` figuran en 0 % (no se usan en las pruebas).

## 3. Tipo de pruebas

| Tipo | Suites | Observación |
|---|---:|---|
| Unitaria con mocks (repos/DataSource mockeados) | 31 | Mayoría |
| Unitaria sobre "base simulada" en memoria (transacción/lock/cola) | 2 (`cobro-cancha-presencial`, `pasarela-cancha`) | Simula atomicidad y concurrencia de JS, no Postgres |
| Integración con módulo Nest real (`createTestingModule`, repos sobreescritos) | 2 (`notificaciones-extensibilidad`, `app.controller`) | Sin DB |
| Estructura | 1 (`auditoria-endpoints`) + parte de `acceso.controller` (metadatos de roles) | Lee metadatos de decoradores |
| Generación real de artefactos | 1 (`comprobante-pdf`) | PDF real en memoria |
| **Con base de datos real** | **0** | Se cumple lo esperado |

(La clasificación es por lectura de encabezados y mocks; una suite puede mezclar categorías, por eso los conteos son aproximados: 31+2+2+1+1 = 37.)

## 4. Reglas de negocio

| Regla | Dónde se implementa (verificado) | Pruebas que existen | Qué verifican | Qué NO verifican |
|---|---|---|---|---|
| **RN01** Un usuario no está en dos sedes a la vez | Índice único `uq_acceso_abierto_por_usuario` en `control-acceso.entity.ts` y chequeo `sesionAbierta` → 409 en `acceso.service.ts` (~l. 235-249) | **Ninguna** sobre el ingreso. `acceso.controller.spec` solo prueba roles y aforo; `usuarios-sede.spec` prueba `asignarSede` (rechazos de rol/baja/sede inexistente) | Permisos del endpoint de ingreso y rechazos al reubicar personal | Que un segundo ingreso con sesión abierta devuelva 409; el índice único; ingreso simultáneo desde dos sedes; reubicación efectiva de personal |
| **RN02** Dos reservas simultáneas de cancha/horario → solo una | Índice único parcial `uq_cancha_horario_confirmado` (estado CONFIRMADA) en `reserva-cancha.entity.ts`; `reservar` → `bookingRepo.crearReservaSegura` | (a) `cobro-cancha-presencial.spec`: "concurrencia (SIMULADA…)" con `Promise.allSettled`, una gana y la otra `ConflictException`, un solo registro confirmado. (b) `pasarela-cancha.spec`: dos **pagos** simultáneos de la misma reserva → uno cobra, otro 409. (c) `reserva-cancha-turnos.spec`: turno válido llama a `crearReservaSegura` | Lógica de atomicidad/lock con una base simulada (cola por cancha); rollback sin restos; un solo cobro | Concurrencia real contra Postgres; el índice único; el camino de **reserva online** (`reservar`) ante choque de horario (el repositorio está mockeado, no hay prueba de `23505` → 409 para canchas); dos usuarios distintos reservando a la vez. El `ReservaCancha` `.in-memory` repository no se usa |
| **RN03** Socio vencido no reserva con descuento pero paga tarifa de externo | `reserva-cancha.service.ts` (`estadoDesde(...).tarifaAplicable()`) | `consumidores-vigencia.spec` (10): con solo próxima/vencida/suspendida no reserva clase; precio con vigente+próxima 8.500 (15 %), con solo próxima/terminada 10.000. `cobro-cancha-presencial.spec`: socio con cuota VENCIDO o SUSPENDIDO paga 10.000, estrategia ESTANDAR. `pagos.service.spec`: socio vencido necesita pago para reactivarse | Cálculo de precio y bloqueo de reserva de clase según vigencia (con fechas congeladas) | Reserva **online** de cancha con socio vencido de punta a punta (hay mock de `calcular` en `reserva-cancha-turnos`); la prueba más relevante vive en un archivo con cambios sin commit |

Nota de lectura: no corrí los tests con la base ni medí la concurrencia real; todo lo anterior sale de leer el código.

## 5. Calidad y fragilidad

- `it.skip`, `xit`, `test.todo`, `.only`, `fit`, `xdescribe`: **ninguno** (búsqueda por regex en `src` y `test`; Jest reporta 0 pendientes y 0 todo).
- Pruebas sin aserciones: una búsqueda automática marcó tres archivos (`app.controller.spec`, `crear-enviador.spec`, `notificaciones-extensibilidad.spec`); al revisarlos a mano todos tienen `expect` reales. No encontré pruebas sin aserciones, pero no revisé las 648 una por una.
- Prueba trivial: `app.controller.spec` (plantilla "Hello World").
- Mocks que vuelven trivial el resultado: `reserva-cancha-turnos.spec` mockea `calcular` del precio y `crearReservaSegura`; la "concurrencia" de RN02 depende de una base simulada propia de la prueba (si el simulador está mal, la prueba pasa igual). `booking-clase.repository.spec` y `clientes.spec` mockean `DataSource.query`: verifican forma de la consulta, no resultado.
- Fechas: `canchas.service`, `gestion-clases`, `horario-argentina`, `membresias.service`, `vigencia`, `cobro-cancha-presencial`, `brevo.enviador` usan `jest.useFakeTimers` (bien). **Frágiles**: `reserva-clase.service.spec.ts:7` calcula fechas con `Date.now()` sin congelar (relativas, aceptable); `reserva-cancha-turnos.spec` usa `2099-01-10` fija. Los `new Date()` en fixtures (`creadaEn`) no afectan aserciones que pude ver.
- Variables de entorno: `crear-enviador.spec` manipula `process.env` (restaura con copia previa); `comprobante-pdf.spec` lee `COMPROBANTE_MUESTRAS` (opcional, escribe PDFs a una carpeta solo si está definida). Ninguna requiere variables para pasar; no leí ningún `.env`.
- Dependencia de orden: no detecté estado compartido entre `it` más allá de `beforeEach`; no lo verifiqué ejecutando en orden aleatorio.
- Fuga de log: las pruebas imprimen `WARN` de Nest en consola (ruido, no fallo).
- Higiene del repo: `consumidores-vigencia.spec.ts` tiene un cambio sin commit (`import { jest } from '@jest/globals'`), distinto del resto de specs, que usan el `jest` global. `coverage/` está ignorado por git.

## 6. Huecos priorizados (por riesgo)

| # | Área / flujo | Estado actual | Riesgo | Sugerencia |
|---|---|---|---|---|
| 1 | Acceso por QR / ingreso-egreso (`acceso.service`, 35 %) | Solo roles y aforo; sin pruebas de validar QR, código vencido, RN01, aforo máximo, egreso | Alto (seguridad física + RN01) | Pruebas unitarias del servicio con repos mockeados |
| 2 | Reserva online de cancha ante choque (RN02) y socio vencido | `crearReservaSegura` mockeado; sin caso de conflicto | Alto | Prueba del repositorio con `23505` → 409; y una de integración con Postgres de prueba |
| 3 | Auth (`auth.service` 25 %, `auth.controller`, `jwt.strategy` 0 %) | Solo helper de expiración | Alto | Login, bloqueo sin verificar, cookies, token inválido |
| 4 | Pagos: `comprobantes.service` (25 %), `pasarela-mock` (0 %), ramas de `pagos.service` (74 %) | Buena cobertura de cobros, hueco en comprobantes y reembolsos/errores | Medio-alto | Completar ramas de error |
| 5 | Precios (`precios.service` 31 %, `precios.controller`) | Solo `canchas/pricing` al 100 % | Medio-alto (afecta cobros) | Pruebas de lectura/actualización de precios de plan |
| 6 | Auditoría (`auditoria.interceptor` 0 %, `auditoria.service` 32 %) | Solo `auditoria-endpoints` (estructura) y redactor de secretos | Medio | Probar que se registra la acción y se redactan secretos |
| 7 | Sedes / franjas / tipos de cancha / instructores / admin | 17-35 % | Medio | CRUD con mocks |
| 8 | Reparto de horas (7 %) | Sin pruebas | Medio | Probar algoritmo |
| 9 | Integración con base real (Postgres de prueba) | Inexistente | Alto transversal | Contenedor Postgres en CI para índices únicos y concurrencia |

## 7. Cliente (`frontend/`)

- `frontend/package.json` no declara `test`, `vitest`, `jest`, `playwright`, `cypress` ni `@testing-library`, y no hay archivos `*.test.*`/`*.spec.*` en `frontend/src`. **No hay runner.**
- Qué probar primero (sugerencia, no verificado en código del cliente): Vitest + Testing Library; funciones puras de formateo/fechas/precios y de mapeo de estados de membresía; luego formularios de login y pago con la API mockeada.

## 8. CI

- **No existe `.github/workflows`** (verificado: la ruta no existe). No hay CI.
- Las pruebas de `npm test` (Jest) no requieren variables de entorno ni base de datos para pasar: `crear-enviador.spec` define las suyas y `comprobante-pdf` solo usa una opcional. En un entorno limpio con `npm ci` deberían correr; no lo probé en un entorno limpio real (mi ejecución fue en esta máquina, con `backend/.env` presente aunque no lo leí). `npm run test:e2e` sí necesitaría base y variables.
- Faltante: no hay script de lint/typecheck/test unificado ni reporte de cobertura con umbral (`jest` no define `coverageThreshold`).

## Lo que no pude verificar

- Ejecución del e2e (`test:e2e`) y comportamiento real de índices únicos/concurrencia (no se toca la base).
- Que las pruebas pasen en un entorno realmente limpio (sin `.env`) y en orden aleatorio.
- La suite del cliente (no existe) y su cobertura.
- Calidad semántica fina de cada una de las 648 pruebas: se revisaron por muestreo y por búsquedas de patrones.
