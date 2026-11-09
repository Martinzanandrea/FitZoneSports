# Auditoría de estado de entrega — FitZone Sports

Fecha: 2026-11-09 · Rama `main` (HEAD `a0c3e5b`) · Auditoría de solo lectura (único archivo creado: este informe).
Estado inicial del árbol (`git status --short`): 5 archivos modificados y 2 sin seguimiento en `acceso` (cliente y servidor), **ajenos a esta auditoría**; no se tocaron.

**Limitaciones declaradas.** No tengo el texto del Anexo G ni la rúbrica vigente dentro del repositorio: el checklist de la sección (b) se armó con los ítems que enumera el pedido. Tampoco hay documento de requisitos con la lista RF-01…RF-14 / RNF; los nombres de cada RF se infieren de `docs/LOG.md`, `docs/adr/` y comentarios del código (marcados "inferido"). Lo que depende de GitHub o Jira figura como NO VERIFICABLE.

---

## (a) Resumen ejecutivo

1. El producto funciona y está desplegado (Vercel + Render + Supabase): 39 suites / 744 pruebas del servidor pasan; cobertura 72,2 % sentencias, 64,1 % ramas, 49,8 % funciones, 73,2 % líneas.
2. **No existe** `docker-compose.yml`, ningún `Dockerfile`, `LICENSE`, `swagger.json` exportado ni script de seed: cuatro ítems de la raíz/arranque están en FALTA.
3. Estructura: carpetas `server/` y `client/` en vez de `backend/` y `frontend/`; `docs/` tiene solo `adr`, `C4`, `testing` y archivos sueltos. Faltan `diagramas`, `bitacoras`, `manuales`, `planificacion`, `rnf`, `entregables` (esta última se crea con este informe).
4. README raíz: cubre "qué es", stack, patrones y licencia (título vacío); **faltan** integrantes con rol P1–P4, puesta en marcha, credenciales de prueba, tabla de enlaces, estado de pruebas y declaración de IA/bibliotecas.
5. ADR: 13 existentes, ninguno con la plantilla completa (sin tabla de alternativas, autor ni sprint). De los 10 obligatorios, solo 001 existe completo en contenido (como 0002); 002, 005, 006 están cubiertos de forma parcial dentro de 0003/0004, y **faltan 003, 004, 007, 008, 009 y 010** (ver sección 10).
6. Diagramas: 3 fuentes `.drawio` y 2 PNG (C4 contexto y contenedores). De los 14 obligatorios, 0 están completos y verificados; 1–3 están parcialmente.
7. Planificación, manuales y bitácoras individuales `LOG-<apellido>.md`: no existen; hay una `docs/LOG.md` única (16,9 KB) y un reporte de QA (`docs/PRUEBAS.md`).
8. **Acceso offline: no existe soporte.** El cliente bloquea las operaciones de acceso sin conexión. Solo hay dos columnas en la entidad (`validado_offline`, `sincronizado_en`) sin ningún código que las use.
9. Discrepancias de negocio: el recargo de hora pico es **15 %** en el código (el pedido dice 20 %); el comportamiento del socio en mora se resuelve por el contexto de la estrategia, no con una clase propia.
10. Git: 102 commits de 3 autores (martin 80 con las dos identidades, Teo 12, maxi 10); 6 commits referencian `FT1-nn`; el último commit es del 2026-10-29 (semanas 43 y 45 sin actividad).

---

## (b) Checklist del Anexo G

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | `backend/` con `src/` (usuarios, acceso, clases, canchas, pagos, common), `test/`, `swagger.json` | PARCIAL | Existe `server/` con esos módulos (más 9 adicionales) y `server/test/app.e2e-spec.ts` (solo prueba "Hello World"). No hay `swagger.json`. Nombre de carpeta distinto. |
| 2 | `frontend/` con `src/portal`, `admin`, `components`, `services`, `store` | PARCIAL | `client/src/` tiene `modules/` por dominio, `shared/`, `api/`, `routes/`. No hay carpetas `portal`/`admin`/`services`/`store`; la separación existe por rutas (`client/src/routes/AppRoutes.tsx`: `/dashboard…` socio, `/admin/…` consola) y dos shells (`shared/layout/ClienteShell.tsx`, `AppShell.tsx`). |
| 3 | `docs/` con adr, diagramas, bitacoras, manuales, planificacion, rnf, entregables | FALTA (6 de 7) | `ls docs`: `C4`, `LOG.md`, `PRUEBAS.md`, `adr`, `testing`. |
| 4 | `README.md` en raíz | PARCIAL | Ver sección 2. |
| 5 | `LICENSE` | FALTA | `git ls-files` no lo lista; en `README.md` el título "Licencia" está vacío. `server/package.json` declara `"license": "UNLICENSED"`. |
| 6 | `docker-compose.yml` | FALTA | No existe en el árbol ni en el historial de archivos versionados. |
| 7 | `.env.example` | OK | `server/.env.example`, `client/.env.example` (solo claves, sin valores). No hay uno en la raíz. |
| 8 | Dockerfiles servidor y cliente | FALTA | Búsqueda de `Dockerfile*` sin resultados. |
| 9 | Seed (≥25 sedes, canchas, clases, usuarios de 4 roles) | FALTA | Ver sección 4. |
| 10 | Migraciones reproducibles + reversión | PARCIAL | Ver sección 5. |
| 11 | Sin secretos versionados | PARCIAL | Ver sección 6: 1 hallazgo a confirmar a mano; sin `.env` versionados. |
| 12 | `swagger.json` exportado + Swagger UI en desarrollo | PARCIAL | UI: `server/src/main.ts` (`SwaggerModule.setup('api', …)`, solo si `NODE_ENV !== 'production'`). Exportación al repo: no existe. |
| 13 | Pruebas con umbral de cobertura | PARCIAL | 744 pruebas; sin `coverageThreshold` (búsqueda en `server/package.json` y configs). |
| 14 | CI | PARCIAL | `.github/workflows/ci.yml`: servidor `tsc --noEmit`, `npm test -- --coverage`, `npm run build`; cliente solo `npm run build`. Sin lint, sin umbral, sin e2e. |
| 15 | Protección de ramas / PR obligatorio | NO VERIFICABLE | Revisar en GitHub: Settings → Branches. Hay `origin/qa/sprint5-pruebas` y un PR mergeado (#2) en el historial. |
| 16 | ≥10 ADR con plantilla | PARCIAL | 13 ADR; ninguno cumple la plantilla (sección 10). |
| 17 | 14 diagramas con fuente y exportación | FALTA / PARCIAL | Sección 11. |
| 18 | Planificación completa | FALTA | Sección 12. |
| 19 | 3 manuales | FALTA | No hay carpeta `manuales` ni archivos equivalentes. |
| 20 | Bitácoras individuales `LOG-<apellido>.md` | PARCIAL | Una sola `docs/LOG.md` (16.879 bytes, 3 integrantes: Martín Zanandrea, Teo Ava, y Máximo Retamoso en `docs/PRUEBAS.md`). No hay archivos por persona. |
| 21 | Tablero Jira | NO VERIFICABLE | Comprobar a mano: tarjetas FT1-nn, sprints, asignación. Los mensajes de commit citan FT1-nn solo 6 veces. |
| 22 | Historial git con autoría distribuida | PARCIAL | Sección 14. |

---

## 1. Estructura obligatoria

**Mapeo actual → exigido**

| Exigido | Actual | Comentario |
|---|---|---|
| `backend/` | `server/` | Renombre pendiente. |
| `backend/src/usuarios, acceso, clases, canchas, pagos, common` | `server/src/usuarios, acceso, clases, canchas, pagos, common` | Todos presentes. Además: `admin, auditoria, auth, clientes, database, entities, instructores, membresias, notificaciones, precios, sedes, storage`. |
| `backend/test/` | `server/test/` | Contiene un único e2e de plantilla que espera `Hello World!` y requiere `AppModule` completo (base real); no se ejecuta en CI. Las pruebas unitarias viven junto al código (`*.spec.ts`). |
| `backend/swagger.json` | — | No existe. |
| `frontend/` | `client/` | Renombre pendiente. |
| `frontend/src/portal, admin, components, services, store` | `client/src/modules/*`, `shared/components`, `api/axios.ts`, sin store global | No hay `store` (el estado usa contextos: `modules/auth/AuthContext.tsx`). |

**M1 a M5 en el servidor.** No hay documento que defina M1–M5 en el repo. Por `docs/LOG.md` se infiere M2 = "Gimnasio y Acceso" (`acceso`) y M5 = "Pagos" (`pagos`). Los otros tres módulos no están nombrados en ningún archivo; se asume lo siguiente (**a confirmar por el equipo**): M1 usuarios/auth/sedes, M3 clases, M4 canchas.

**Portal del socio vs consola de administración.** Sí hay separación funcional en una sola SPA: login distinto (`/login` con `audience="cliente"` y `/admin/login` con `audience="staff"`), rutas protegidas por rol, y dos layouts.

**Lugares que referencian los nombres actuales `server/` y `client/` (para planificar el renombre; no se hizo)**

| Archivo | Línea(s) | Qué referencia |
|---|---|---|
| `.github/workflows/ci.yml` | 15, 23, 42, 50, 58 | `working-directory`, `cache-dependency-path`, `path` del artefacto de cobertura |
| `README.md` | 43, 47 | Texto de estructura y ruta `server/src/notificaciones/` |
| `docs/adr/0012-envio-de-correo-con-proveedor-abstracto.md` | 22, 81 | `server/src/common/mail/`, `server/.env.example` |
| `docs/adr/0013-vigencia-de-membresias-por-fechas.md` | 37 | `server/src/membresias/vigencia.ts` |
| `docs/testing/informe-auditoria-testing.md` | 3, 7, 11, 13, 56, 58, 144, 146, 152 | Rutas `server/` y `client/` |
| `server/db/sql/001…`, `002…`, `004…`, `008…` | 6; 4; 19; 5 | Comentarios con rutas `server/src/…` y `client/public/…` |

No hay Dockerfiles, `docker-compose.yml` ni `package.json` raíz que referencien las carpetas. Los scripts de `client/package.json` y `server/package.json` usan rutas relativas internas (`src/**`, `test/**`), sin el nombre de la carpeta. `client/vercel.json` apunta al backend por URL (`https://fitzonesports.onrender.com`), no por carpeta. **Fuera del repo, a revisar a mano:** *Root Directory* del proyecto en Vercel (`client`) y de Render (`server`), y cualquier variable o webhook que los mencione.

---

## 2. README raíz (`README.md`, 2.822 bytes)

| Elemento exigido, en orden | Estado | Evidencia |
|---|---|---|
| 1. Qué es el sistema | OK | Primer párrafo y "Funcionalidades principales". |
| 2. Integrantes con rol P1–P4 y usuario de Git | FALTA | No hay lista de integrantes. Los autores git son `martin`, `Teo`, `maxi` (3 identidades; el equipo se describe como de 4 en `docs/LOG.md`). |
| 3. Puesta en marcha ≤5 pasos | FALTA | No hay instrucciones; solo enlace a la demo. |
| 4. Credenciales de prueba por rol | FALTA | No hay. (No se deben incluir credenciales reales; usar cuentas de un seed.) |
| 5. Tabla de enlaces a ADR, diagramas, manuales, bitácoras | PARCIAL | Solo enlaza `docs/adr/`. |
| 6. Estado de pruebas y cobertura | FALTA | No figura. |
| Declaración de uso de IA y bibliotecas de terceros | FALTA | No figura. |

Observación: el README dice "13 módulos de dominio" y atribuye al patrón Repository el "control de concurrencia" (ver sección 9). El título "Licencia" está vacío.

---

## 3. Docker y arranque

- `Dockerfile` servidor, `Dockerfile` cliente, `docker-compose.yml`: **no existen**. `docker compose up --build` fallaría por falta de archivo.
- No hay servicio de base con esquema aplicado. El esquema se aplica a mano: `server/src/database/database.module.ts` fija `synchronize: false` y `server/db/sql/001-schema-base.sql` es un volcado de la base de Supabase. La aplicación depende de Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, buckets de fotos y comprobantes) para almacenamiento; un compose local necesitaría resolver eso (a decidir por el equipo).
- El despliegue actual es por plataforma (Render/Vercel), sin contenedores.

## 4. Datos de prueba (seed)

**No existe** un script de seed. Búsqueda de `seed` / `INSERT INTO` en `server/src` y `server/db`: solo hay inserciones de la tabla de auditoría (`001`, `002`, `008`, comentario) y `server/db/sql/004-tipos-cancha.sql:21` (catálogo de tipos de cancha). No hay carga de sedes, canchas, clases ni usuarios. El alta de sedes se hace por API (`POST /sedes`, `server/src/sedes/sedes.controller.ts:61`). **Cantidad de sedes en la base de producción: NO VERIFICABLE** (no se consultó la base).

## 5. Migraciones

| Script | Contenido |
|---|---|
| `001-schema-base.sql` | `pg_dump --schema-only` (9/9/2026), base de todo el modelo |
| `002-auditoria-tabla-y-trigger.sql` | Tabla y trigger de auditoría |
| `003-email-verificado.sql` | Verificación de email |
| `004-tipos-cancha.sql` | Tabla `tipos_cancha` + datos |
| `005-gerente-sede.sql` | Rol gerente de sede |
| `006-notificaciones.sql` | Notificaciones |
| `007-diagnostico-membresias.sql` | Solo diagnóstico |
| `008-redactar-secretos-auditoria.sql` | Limpieza de datos de auditoría (con `BEGIN`/`COMMIT`) |
| `009-diagnostico-membresias-superpuestas.sql` | Solo diagnóstico |
| `010-membresias-sin-superposicion.sql` | Restricción de no superposición |

- **Reproducibilidad desde cero: PARCIAL / no verificada.** No se ejecutó (regla de solo lectura). Hay indicios de superposición: `001` ya trae auditoría y `002` crea de nuevo `auditoria` y sus índices (`002:19-21` repite `idx_auditoria_*` que `001:676-690` ya define), lo que sugiere que correr `001` + `002` en orden fallaría por objetos existentes. Verificar en una base vacía.
- **No hay herramienta de migraciones** (TypeORM migrations, Flyway, etc.) ni registro de versión aplicada.
- **Reversión: FALTA.** No hay scripts `down`. Solo `008` menciona `ROLLBACK` como alternativa manual al `COMMIT`.

## 6. Secretos

Se escaneó el árbol versionado (`git grep`) y todos los commits (`git rev-list --all` + `git grep`) con patrones de cadenas de conexión con credenciales, JWT, claves privadas, `ghp_`, `AKIA`, `xkeysib-`, asignaciones `*_SECRET|PASSWORD|TOKEN|API_KEY`. `gitleaks` y `trufflehog` **no están instalados** (no se instaló nada). No se leyeron archivos `.env`.

| Archivo:línea | Tipo | Estado |
|---|---|---|
| `server/src/common/mail/brevo.enviador.spec.ts:4` | Constante `API_KEY` con prefijo de clave Brevo | Presente en 17 commits. Por su longitud (línea de 50 caracteres) parece un valor de prueba y no una clave real, pero **no se puede confirmar sin ver el valor**: verificar a mano y, si fuera real, rotarla en Brevo. |
| `server/src/acceso/acceso.service.spec.ts:16, 226` | Secreto JWT de prueba (nombre `SECRETO`) | Falso positivo probable (valor de test). |
| `server/src/common/mail/crear-enviador.spec.ts:77, 85` | `BREVO_API_KEY` de prueba (`'clave-secreta'`) | Falso positivo (valor de test). |

- Archivos `.env` en el historial: ninguno (solo `server/.env.example` y `client/.env.example`).
- `.gitignore`: presentes en `server/` y `client/`; no hay `.gitignore` en la raíz.

## 7. Contrato de API

- `swagger.json` en el repo: **no existe**. El documento se genera en tiempo de ejecución desde `@nestjs/swagger` (`server/src/main.ts`) y no se escribe a disco.
- Swagger UI: **sí**, ruta `/api`, deshabilitada con `NODE_ENV=production`. Declara autenticación por cookie `token`.

## 8. Pruebas

Ejecutado el 2026-11-09 en `server/`: `npx jest --coverage`.

| Métrica | Resultado |
|---|---|
| Suites / pruebas | **39 / 744**, todas pasan |
| Sentencias | 72,21 % (3378/4678) |
| Ramas | 64,14 % (1864/2906) |
| Funciones | 49,79 % (373/749) |
| Líneas | 73,24 % (3107/4242) |

(El informe previo `docs/testing/informe-auditoria-testing.md` del 29/10 registraba 37 suites / 648 pruebas; quedó desactualizado.)

- `coverageThreshold`: **no declarado**. `collectCoverageFrom` es `**/*.(t|j)s` (incluye todo `src`).
- Pruebas de integración contra base real: **no hay**. Los specs usan repositorios en memoria (`booking-cancha.in-memory.repository.ts`, `booking-clase.in-memory.repository.ts`) o dobles.
- Prueba de concurrencia real: **no hay** (el lock y los índices únicos solo se ejercitan con simulaciones). La prueba manual en producción de `docs/PRUEBAS.md` cubre doble clic de pago (U3), no carreras de reserva.
- Pruebas del cliente: **no hay** (`client/package.json` sin `test`, `vitest`, `jest`, `playwright` ni `cypress`; confirmado en `docs/testing/informe-auditoria-testing.md` §7).
- E2E: `server/test/app.e2e-spec.ts` (plantilla, no ejecutada en CI). No hay E2E de navegador.
- `.github/workflows/ci.yml` (dispara en push y PR a `main`):
  - Servidor: `npm ci` → `npx tsc --noEmit` → `npm test -- --coverage` → `npm run build` → sube `server/coverage` como artefacto (`if: always()`).
  - Cliente: `npm ci` → `npm run build` (`tsc -b && vite build`).
  - **Bloquea** el job completo ante cualquier fallo de esos pasos; **no bloquea** por cobertura (sin umbral). Sin lint ni e2e. Que el CI sea requisito de merge: NO VERIFICABLE (depende de la protección de ramas en GitHub).
  - Comprobar el último resultado en la pestaña Actions de GitHub (no verificable desde acá).

## 9. Matriz de funcionalidad

Los nombres de RF/RN/RNF salen de comentarios y bitácoras; donde no hay referencia explícita está marcado como inferido. "Pruebas" = specs del servidor; ninguna cubre base real.

| Req. | Descripción (fuente) | Módulo / archivos principales | Pruebas | Estado |
|---|---|---|---|---|
| RF-01 | Registro/autenticación (inferido) | `auth/`, `usuarios/` | `usuarios-duplicados.spec.ts`, `email-verificacion.service.spec.ts`, `jwt-expiracion.helper.spec.ts` | IMPLEMENTADO (inferido) |
| RF-02 | Membresía con plan vigente (ADR 0006) | `membresias/`, `precios/` | `membresias.service.spec.ts`, `vigencia.spec.ts`, `membresias-huerfanas.spec.ts` | IMPLEMENTADO |
| RF-03 | Interoperabilidad entre sedes (ADR 0004) | `sedes/`, `entities/sede.entity.ts`, `usuarios-sede.spec.ts` | `usuarios-sede.spec.ts` | IMPLEMENTADO |
| RF-04 | Control de acceso por QR (`acceso.service.ts`) | `acceso/`; cliente `modules/acceso/` | `acceso.service.spec.ts`, `acceso.controller.spec.ts`, `acceso-dni.spec.ts` (sin seguimiento) | IMPLEMENTADO (solo en línea; ver offline) |
| RF-05 | Ingreso/egreso y aforo (`acceso.service.ts`) | `acceso/` | idem | IMPLEMENTADO |
| RF-06 | Clases grupales (`LOG.md`, ADR 0009) | `clases/clases.service.ts`, `generacion-ocurrencias.service.ts` | `gestion-clases.spec.ts`, `horario-argentina.spec.ts` | IMPLEMENTADO |
| RF-07 | Reserva de clase | `clases/reserva-clase.service.ts`, `booking-clase.repository.ts` | `reserva-clase.service.spec.ts`, `booking-clase.repository.spec.ts`, `reservas-controllers.spec.ts` | IMPLEMENTADO |
| RF-08 | Lista de espera | `clases/listeners/lista-espera.listener.ts`, `events/clase.events.ts` | `lista-espera.listener.spec.ts` | IMPLEMENTADO |
| RF-09 | (sin referencia en el repo) | — | — | NO VERIFICABLE (definir con el equipo) |
| RF-10 | (sin referencia en el repo) | — | — | NO VERIFICABLE |
| RF-11 | Precio dinámico de canchas | `canchas/pricing/*`, `canchas/reserva-cancha.service.ts` | `reserva-cancha.service.spec.ts`, `canchas.service.spec.ts` | PARCIAL: el recargo en código es 15 %, no 20 % |
| RF-12 | Mantenimiento de cancha (inferido) | `entities/cancha.entity.ts` (`EstadoCancha.MANTENIMIENTO`), `bloqueo-cancha.entity.ts`, `POST canchas/:id/bloqueos` | `canchas.service.spec.ts`, `reserva-cancha-turnos.spec.ts` | IMPLEMENTADO |
| RF-13 | Registro de pagos (`LOG.md`) | `pagos/pagos.service.ts`, `gateway/pasarela-mock.service.ts`, `pagos.controller.ts` | `pagos.service.spec.ts`, `cobro-efectivo.spec.ts`, `cobro-cancha-presencial.spec.ts`, `cobro-reserva-existente.spec.ts`, `pasarela-cancha.spec.ts` | PARCIAL: la pasarela es un mock |
| RF-14 | Comprobante PDF | `pagos/comprobantes/pdf-generator.service.ts` (pdfkit), `comprobantes.controller.ts` (`GET :id/archivo`) | `comprobante-pdf.spec.ts`, `historial-comprobantes.spec.ts` | IMPLEMENTADO |
| RN-01 | Un usuario no puede estar en dos sedes a la vez | `entities/control-acceso.entity.ts:16` | `acceso.service.spec.ts` | IMPLEMENTADO |
| RN-02 | No sobreventa de cancha/cupo | `canchas/booking-cancha.repository.ts`, `clases/booking-clase.repository.ts` | specs de reservas (in-memory) | IMPLEMENTADO (sin prueba contra Postgres) |
| RN-03 | Beneficios solo con membresía activa; clases incluidas en la membresía | `membresias/membresias.service.ts`, `pricing/member-discount-pricing.strategy.ts`, `clases/reserva-clase.service.ts` | `membresias.service.spec.ts` | IMPLEMENTADO |
| RNF-01 | Validación de QR sin conexión | Solo columnas en `control-acceso.entity.ts:45-50` | — | NO IMPLEMENTADO |
| RNF-02 | Sin datos de tarjeta | `pasarela-mock.service.ts` devuelve un token `MOCK-…`; ninguna entidad tiene campos de tarjeta | `pasarela-cancha.spec.ts` | IMPLEMENTADO (por ausencia, con pasarela simulada) |
| RNF-03 | Índices | `001-schema-base.sql:669-844` (≈30 índices), `@Index` en entidades | — | IMPLEMENTADO |
| RNF-04 | Alta de sede por configuración | `sedes.controller.ts` (`POST /sedes`, franjas) | — (sin spec de `sedes`) | IMPLEMENTADO |

**Precio dinámico (Strategy).** Sí: interfaz `PricingStrategy` (`aplica`/`calcular`), implementaciones `MemberDiscountPricing` (−15 %, solo socio activo) y `PeakHourPricing` (hora pico 19:00–20:59, **+15 %**), orquestadas por `PricingCalculatorService`, que recibe el arreglo por el token `PRICING_STRATEGIES` (`canchas.module.ts:57-62`). Detalles:
- Tarifa estándar: `ESTANDAR`, sin estrategia aplicada.
- **Recargo: 15 % en el código** (`peak-hour-pricing.strategy.ts`); el pedido indica 20 %. No se encontró ninguna constante de 20 %.
- Socio en mora: no hay una clase "tarifa de externo". El estado de la membresía (`membresias/estado-membresia.ts`, clases por estado con `tarifaAplicable()`) devuelve `'EXTERNO'` si no está activa, y `reserva-cancha.service.ts:247-254` fija `esSocioActivo=false`, con lo cual no se aplica el descuento. Es decir, la "tarifa de externo" es el precio sin descuento. Si la tarifa de externo debe ser un valor distinto, no está implementado.
- Observación: el descuento y el recargo se **acumulan** (`SOCIO_HORA_PICO`); el orden de las estrategias en el arreglo influye en el resultado final.

**RN-02 en la base.** Índice único parcial `uq_cancha_horario_confirmado ON reservas_cancha (cancha_id, fecha, hora_inicio) WHERE estado='CONFIRMADA'` (`001-schema-base.sql:844`, `reserva-cancha.entity.ts:22`), más bloqueo pesimista `SELECT … FOR UPDATE` sobre la fila de la cancha dentro de transacción (`booking-cancha.repository.ts:67`). Para clases: `UNIQUE (ocurrencia_id, usuario_id)` (`001:638`) y lock pesimista sobre la ocurrencia (`booking-clase.repository.ts:39`). No hay restricción de exclusión por rango (solo igualdad de hora de inicio; reservas con horas de inicio distintas pero solapadas dependen del lock y de la lógica de turnos de `turnos-cancha.ts`).

**RN-01 en la base.** Índice único parcial `uq_acceso_abierto_por_usuario ON control_acceso (usuario_id) WHERE hora_egreso IS NULL` (`001:837`): solo una sesión abierta por usuario. Controlado además en `acceso.service.ts` (traduce la violación `23505` a 409).

**Patrones.**
| Patrón | Dónde | ¿Real? |
|---|---|---|
| Strategy | `canchas/pricing/` | Real: interfaz, implementaciones intercambiables, inyección por token. También en notificaciones (`notificaciones/notificadores/`: Panel, Email, Push) y en el enviador de correo (`common/mail/`). |
| Observer | `clases/events/clase.events.ts`, `clases/listeners/lista-espera.listener.ts` (`@OnEvent(CLASE_CUPO_LIBERADO)`), emisión con `EventEmitter2` en `reserva-clase.service.ts` y `clases.service.ts` | Real (publicador/suscriptor desacoplados con `@nestjs/event-emitter`); el listener promueve al siguiente en espera y notifica. Una sola especialización (cupo liberado / baja de clase). |
| Repository | `IBookingCanchaRepository` y `IBookingClaseRepository` con implementación TypeORM e in-memory, inyectadas por token | Parcial: interfaces con un único método de escritura transaccional ("repositorio de reserva segura"); el resto del acceso a datos usa `Repository<T>` de TypeORM directamente en los servicios. |
| State (adicional) | `membresias/estado-membresia.ts` | Real. |

**Acceso offline (RNF-01, RF-04). Informe factual.**
- Validación del QR sin conexión al servidor central: **no existe**. El QR es un token firmado con JWT (`acceso.service.spec.ts` verifica la firma con el secreto del servidor) que se valida solo en `POST` al API (`acceso.service.ts`).
- Concepto de terminal de sede con copia local: **no existe** (sin entidad ni módulo "terminal"; `grep` de `terminal de sede`, `indexeddb`, `localforage`, `cola de ingresos` sin resultados).
- Cola de ingresos con sincronización diferida: **no existe**. Solo hay dos columnas en `control_acceso`: `validado_offline` (default `false`) y `sincronizado_en`; ningún archivo fuera de la entidad las lee ni escribe (búsqueda en `server/src` y `client/src`).
- Qué pasa cuando el servidor no responde: en la pantalla de recepción (`client/src/modules/acceso/pages/ControlAcceso.tsx:134, 170, 217, 235`) si `navigator.onLine` es falso se muestra "Sin conexión a internet" seguido de `TEXTO_REQUIERE_CONEXION` y no se registra ni se autoriza nada. En el portal del socio (`MiQr.tsx:84, 98`) sin conexión no se conserva ni se muestra el QR. El service worker de la PWA (`client/vite.config.ts:54-63`) usa `NetworkOnly` para toda la API: no se cachea nada de datos. Si hay red pero el servidor no responde, el cliente recibe el error de red de axios; no hay reintento ni cola (no se encontró lógica de reintento de ingreso).

## 10. ADR

| Nº | Título | Estado | Fecha (primer commit) | Observaciones |
|---|---|---|---|---|
| 0001 | GitHub como repositorio compartido | Aceptado | 2026-09-06 | |
| 0002 | Monolito modular | Aceptado | 2026-09-06 | |
| 0003 | Stack tecnológico | Aceptado | 2026-09-06 | |
| 0004 | Modelado de datos (UUID, sede, tipos, exclusive arc) | Aceptado | 2026-09-06 | |
| 0005 | Autenticación JWT en cookie y autorización | Aceptado | 2026-09-06 | |
| 0006 | Flujo de membresía y pago obligatorio | Aceptado | 2026-09-06 | |
| 0007 | Montos calculados en servidor | Aceptado | 2026-09-06 | |
| 0008 | Sistema de auditoría | Aceptado | 2026-09-06 | |
| 0009 | Clases recurrentes como plantillas | Aceptado | 2026-09-09 | |
| 0010 | Gmail SMTP como verificador de mails | (ver archivo) | 2026-09-30 (como `0010-resend-…`, renombrado) | Quedó desactualizado frente al ADR 0012 (Brevo). |
| 0011 | Jerarquía de roles de gestión | Aceptado | 2026-10-07 | |
| 0012 | Envío de correo con proveedor abstracto | Aceptado | 2026-10-12 | |
| 0013 | Vigencia de membresías por fechas | Aceptado | 2026-10-18 | |

(Las fechas son las del commit que agregó cada archivo; ningún ADR trae campo de fecha propio.)

**Cumplimiento de la plantilla.** Los ADR 0001–0011 tienen 4 secciones (Estado, Contexto, Decisión, Consecuencias, formato Nygard según `LOG.md`); el 0012 tiene 5 y el 0013 tiene 6. Ninguno tiene tabla de alternativas (0 líneas de tabla en los 13), autor, sprint ni requisitos relacionados de forma estructurada (menciones sueltas de RF/RN en 0002, 0004, 0006, 0007, 0009). Estado "Aceptado" ya está presente.

**Mapeo con los diez obligatorios**

| Obligatorio | Situación |
|---|---|
| 001 Estilo arquitectónico | Existe como **0002** (monolito modular). |
| 002 Motor de base de datos | Parcial en **0003** (stack) y **0004** (modelado); no hay ADR dedicado de PostgreSQL vs alternativas. |
| 003 Estrategia offline del acceso | **FALTA** (y no hay implementación). |
| 004 Control de concurrencia en reservas | **FALTA** como ADR; solo se menciona en **0002** y en la bitácora (lock pesimista + índice único). |
| 005 Framework backend/IoC/ORM | Parcial en **0003**. |
| 006 Framework frontend/componentes/estado | Parcial en **0003**; no trata estado global. |
| 007 Sincronización del terminal de sede | **FALTA** (no existe el concepto). |
| 008 Estrategia de pruebas y umbral | **FALTA** (existe `docs/testing/informe-auditoria-testing.md`, que es un informe, no un ADR). El número 0008 está ocupado por "auditoría". |
| 009 Despliegue/contenerización/reversión | **FALTA**; la bitácora dice que se eliminó un ADR de despliegue (Railway→Render). |
| 010 Medios de pago y tokenización | **FALTA** como ADR; **0006** y **0007** tratan el flujo y los montos. |

Los ADR 0001, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012 y 0013 no corresponden a ninguno de los diez obligatorios. La numeración del repositorio **colisiona** con la exigida: 0003, 0008, 0009 y 0010 existen con otro contenido.

## 11. Diagramas

Existen en `docs/C4/`: `ModeloContextoc4.drawio`, `Diagramacontenedoresc4.drawio`, `DiagramaComponentesc4.drawio`, `C4-Contexto.png`, `C4-Contenedores.png`. Último commit sobre la carpeta: 2026-09-04. No hay PNG de componentes, ni metadatos (autor/fecha/versión) verificables dentro de las imágenes (no se abrieron los `.drawio` por su tamaño; verificar a mano).

| # | Diagrama | Estado |
|---|---|---|
| 1 | C4-1 Contexto | PARCIAL: fuente `.drawio` + PNG; sin autor/fecha/versión visibles. |
| 2 | C4-2 Contenedores (portal, consola, terminal de sede, API, base) | PARCIAL: existe, pero no hay terminal de sede en el sistema (coherente con el código; no coherente con lo exigido). Revisar que no muestre otros elementos. |
| 3 | C4-3 Componentes de Canchas | FALTA: un solo `DiagramaComponentesc4.drawio` genérico, sin exportación. |
| 4 | C4-3 Componentes de Acceso | FALTA |
| 5 | UML de clases del dominio | FALTA |
| 6 | Secuencia reserva de cancha con pago | FALTA |
| 7 | Secuencia reserva concurrente | FALTA |
| 8 | Secuencia validación de acceso offline | FALTA (el flujo no existe en el código) |
| 9 | Estados de Membresía | FALTA (hay estados ACTIVO/VENCIDO/SUSPENDIDO en `entities/enums.ts:19`) |
| 10 | Estados de Reserva | FALTA (`RESERVADA/LISTA_ESPERA/CANCELADA/ASISTIO/NO_ASISTIO` para clases; `CONFIRMADA/CANCELADA` para canchas) |
| 11 | Actividad de Lista de espera | FALTA |
| 12 | DER físico | FALTA (existe `001-schema-base.sql` como fuente) |
| 13 | Despliegue | FALTA |
| 14 | Arquitectura del pipeline | FALTA (CI en `.github/workflows/ci.yml`) |

Discrepancias contra el código: no se pudo comparar el contenido de los `.drawio` con los 13+ módulos actuales (se agregaron `notificaciones`, `push`, `instructores`, `clientes` después de septiembre). El README habla de 13 módulos; el ADR 0002 lista 12 sin `notificaciones`, `clientes`, `storage`.

## 12. Planificación (`docs/planificacion/`)

La carpeta **no existe**. Estado de cada artefacto exigido:

| Artefacto | Estado | Observaciones |
|---|---|---|
| Plan de proyecto (alcance, supuestos, restricciones, integrantes, horas) | FALTA | |
| Estructura de desglose (épicas, historias, subtareas, estimación, criterios) | FALTA | Las bitácoras citan FT1-nn (hasta FT1-42), sin documento que las agrupe. |
| Cronograma de 8 sprints con vista visual | FALTA | `docs/PRUEBAS.md` menciona "Sprint 5"; no hay cronograma. |
| Asignación y carga por integrante | FALTA | |
| Matriz de trazabilidad RF/RN/RNF → historia → prueba | FALTA | La matriz de la sección 9 puede servir de base. |
| Seguimiento estimado vs trabajado por sprint | FALTA | |
| Registro de riesgos con "qué ocurrió" y análisis de desvíos | FALTA | |
| Tablero Jira | NO VERIFICABLE | Comprobar en Jira: tarjetas FT1-nn, sprints cerrados, asignados, estimaciones y horas registradas. |

## 13. Manuales y bitácoras

- Manuales (3): **no existen**. No hay carpeta ni documentos de usuario/instalación/administración.
- Bitácoras individuales `docs/bitacoras/LOG-<apellido>.md`: **no existen**. Hay `docs/LOG.md` (16.879 bytes, ~110 líneas útiles) con entradas por unidad de Martín Zanandrea y Teo Ava, con hash de commit. `docs/PRUEBAS.md` (11.780 bytes) es el reporte de QA de Máximo Retamoso. El cuarto integrante: sin evidencia en el repo (no hay autor git adicional).
- `docs/testing/informe-auditoria-testing.md` (15.577 bytes): informe técnico de pruebas, no es bitácora.

## 14. Historial de git

`git shortlog -sne --all` (102 commits, desde 2026-08-15):

| Autor | Commits |
|---|---|
| martin (`martinzanandrea09@…`) | 76 |
| Martin Zanandrea (misma cuenta, otra identidad; incluye merges de PR) | 4 |
| Teo (`teoava3@…`) | 12 |
| maxi (`maxiretamosotrotta@…`) | 10 |

Concentración: Martín ≈ 78 % (80/102). Hay una identidad duplicada; conviene unificarla con `.mailmap` si se quiere reportar por persona (no se hizo).

**Calidad de mensajes.** Los tipos más frecuentes: `feat` 19, `docs` 10, `fix` 7, `Merge` 6, `Documentacion` 6, `Finalizacion` 5, `Cambios` 4, `adrs` 3, `refactor` 2, `ok` 2. Mensajes sin descripción útil: `ok` (2), `Pruebas` (1) y varios "Cambios …" genéricos (4); ninguno es literalmente `fix`/`update` solo. Mensajes que citan una tarjeta `FT1-nn`: **6 de 102**. Los commits recientes de Martín siguen Conventional Commits (`feat(cliente): …`, `test(acceso): …`, `ci: …`).

**Distribución semanal (ISO, 2026):**

| Sem. | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Commits | 4 | 10 | 19 | 7 | 12 | 4 | 2 | 10 | 12 | 20 | 0 | 2 | 0 |

Sin actividad en las semanas 43 y 45 (hoy es la semana 46). La semana 42 concentra 20 commits.

---

## (d) Trabajo pendiente priorizado

Esfuerzo: S ≤ 0,5 día · M ≈ 1–3 días · L > 3 días. **[A]** = bloquea admisibilidad (ítem exigido de la estructura obligatoria que hoy no existe).

| Prio | Tarea | Esf. | Bloquea |
|---|---|---|---|
| 1 | `docker-compose.yml` + 2 Dockerfiles con base Postgres y esquema aplicado (`001`…`010` en `docker-entrypoint-initdb.d`), resolviendo el almacenamiento Supabase | M | **[A]** |
| 2 | Script de seed reproducible: ≥25 sedes con canchas, clases y usuarios de los 4 roles | M | **[A]** |
| 3 | `README.md` completo (integrantes P1–P4, puesta en marcha ≤5 pasos, credenciales de prueba, tabla de enlaces, estado de pruebas, declaración de IA y bibliotecas) + `LICENSE` | S | **[A]** |
| 4 | Renombre `server/`→`backend/` y `client/`→`frontend/` (seis lugares de la sección 1, más Vercel/Render) y reorganizar `frontend/src` en `portal/admin/components/services/store` | M | **[A]** |
| 5 | Exportar `backend/swagger.json` (script que genere el documento sin servidor en producción) | S | **[A]** |
| 6 | Crear `docs/` obligatorio: `planificacion` (7 artefactos), `manuales` (3), `bitacoras/LOG-<apellido>.md`, `rnf`, `diagramas` | L | **[A]** |
| 7 | ADR faltantes: 003 offline, 004 concurrencia, 007 sincronización, 008 pruebas/umbral, 009 despliegue, 010 pagos/tokenización; reescribir los 13 con plantilla y renumerar según el esquema exigido | L | **[A]** |
| 8 | Diagramas: 12 faltantes + exportaciones PNG/SVG con autor/fecha/versión y verificar los 2 existentes contra el código | L | **[A]** |
| 9 | Decisión del equipo sobre el acceso offline (RNF-01): implementar o declarar alcance excluido; hoy solo hay columnas huérfanas | L (o S si se excluye y se documenta) | Depende de la rúbrica |
| 10 | Corregir el recargo de hora pico (15 % → 20 %, si el requisito es 20 %) y decidir la tarifa de externo para socio en mora | S | Funcional |
| 11 | Pruebas: `coverageThreshold` en `server/package.json`; prueba de integración y concurrencia contra Postgres real (p. ej. contenedor en CI); pruebas del cliente; subir funciones (49,8 %) | L | Rúbrica |
| 12 | CI: sumar lint, cobertura bloqueante, e2e; confirmar protección de rama y PR obligatorio | S | Rúbrica |
| 13 | Verificar a mano el hallazgo de `brevo.enviador.spec.ts:4` y rotar la clave si fuera real; unificar identidad git | S | Seguridad |
| 14 | Migraciones: comprobar que `001`→`010` corren en base vacía (posible conflicto `001`/`002`), agregar scripts `down` o procedimiento de reversión | M | Rúbrica |
| 15 | Reflejo de trazabilidad en commits (FT1-nn) y actividad: retomar commits (semanas 43 y 45 vacías) | S | Evaluación |

## (e) Preguntas que solo el equipo puede responder

1. ¿Cuál es la versión vigente del Anexo G y de la rúbrica, y qué pesa cada ítem? (No están en el repositorio.)
2. ¿Qué define exactamente RF-01 a RF-14, RN-01 a RN-03 y RNF-01 a RNF-04? ¿Cuáles son RF-09, RF-10 y RF-12?
3. ¿Qué módulos son M1 a M5?
4. ¿El recargo de hora pico es 15 % o 20 %? ¿La tarifa de externo para socio en mora es solo "sin descuento" o un precio distinto?
5. ¿RNF-01 (acceso offline) está dentro del alcance de la entrega? Si sí, ¿hay terminal de sede? Si no, ¿se declara como excluido en el plan?
6. ¿Quién es el cuarto integrante (P1–P4)? Git muestra tres autores. ¿`martin` y `Martin Zanandrea` son la misma persona?
7. ¿Qué hay en Jira: sprints, tarjetas, horas estimadas/trabajadas? ¿Cuántos sprints se cerraron?
8. ¿La clave Brevo del test (`brevo.enviador.spec.ts:4`) es real? ¿Hay `.env` o claves compartidas en chats o en la base de producción?
9. ¿La rama `main` tiene protección y PR obligatorio? ¿El CI es requisito de merge?
10. ¿Cuántas sedes hay hoy en la base de producción y con qué datos se hicieron las pruebas de `docs/PRUEBAS.md`?
11. ¿Se renombran las carpetas o se aceptará la equivalencia `server`→`backend` y `client`→`frontend`? ¿Cambia algo en Vercel/Render?
12. ¿Se puede cambiar el almacenamiento (Supabase Storage) por un volumen local para el compose, o debe quedar igual?
