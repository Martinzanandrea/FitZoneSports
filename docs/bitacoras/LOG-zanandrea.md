# Bitácora — Zanandrea, Martín — Rol: Backend lead

Bitácora individual según el mismo formato que `docs/bitacoras/LOG-retamoso.md` (plantilla del Anexo C citada allí). Los hashes, fechas y mensajes provienen de `git log` real. La tarjeta se indica cuando figura en el mensaje del commit o cuando `docs/bitacoras/LOG-retamoso.md` o `docs/LOG.md` la asocian a ese hash; si no, se dice "Sin tarjeta citada en el commit". Los sprints y sus fechas son los de `docs/bitacoras/LOG-retamoso.md`.

**Las horas son estimaciones calculadas a partir de los timestamps de los commits.** Regla: por cada fecha, se ordenan los commits de Martín (sin merges) por hora local; se suman los intervalos entre commits consecutivos de 90 minutos o menos; se suman 30 minutos por cada commit como tiempo previo de trabajo; se redondea a media hora, con mínimo 0,5 h. En las fechas con varias entradas (2026-11-09), cada intervalo se asigna a la entrada del commit posterior. `a566405` no se cuenta porque repite el mensaje y la hora de `3abeccf`. Las horas de cada entrada se calculan solo con los commits de esa fecha, aunque la entrada cite commits de otros días.

Usuario de Git: `martin` y `Martin Zanandrea` (martinzanandrea09@gmail.com). Ambas variantes de nombre usan el mismo correo.

El README del repositorio no asigna el código de rol (P1 a P4) a ningún integrante, por eso el encabezado indica solo el rol.

## Sprint 1 — Arquitectura — Unidad I — 2026-08-13 al 2026-08-27

### 2026-08-21 · 4,5 h

**Tarjeta(s) Jira:** según `docs/bitacoras/LOG-retamoso.md` (commits "del equipo, relacionados con la tarea"): `7862d54` con FT1-37, FT1-40 y FT1-42; `5552f69` y `cdca2b6` con FT1-26; `e22cde0` con FT1-9 y FT1-16. `f3cba13`, `1c30c96` y `06e2be4`: sin tarjeta citada en el commit.

**Actividad**

Construcción del backend con NestJS y TypeORM: creación de módulos y entidades (`7862d54`, 2026-08-15), módulos de usuarios, clases, instructores y membresías (`5552f69`, 2026-08-20), lógica de negocio de canchas (`cdca2b6`, 2026-08-20), pasarela de pagos, pago en efectivo y comprobantes (`06e2be4`, 2026-08-21) y cierre y despliegue del backend (`f3cba13`, `1c30c96`, 2026-08-21). Según `docs/LOG.md`, 13 módulos con Swagger documentado.

**Decisión**

Monolito modular con NestJS y PostgreSQL (ADR-0002, `e22cde0`, 2026-08-24), motivado en `docs/LOG.md` por la necesidad de transacciones ACID para la regla RN-02 (anti-sobreventa de canchas).

**Problema o bloqueo**

Según `docs/LOG.md`, el límite de peticiones global estaba demasiado estricto (20 por minuto) y producía errores 429 en el uso normal de desarrollo; se ajustó a 200 por minuto, manteniendo 5 por minuto en el login. Después, en `14ed42d` (2026-09-07), un comentario en `auth.controller.ts` deja constancia de que el límite de intentos del login no se aplicaba: el endpoint aceptaba POST sin límite y sospechaba de la versión de NestJS o de TypeScript. El commit no registra la solución.

**Commits**

- `7862d54`, `5552f69`, `cdca2b6`, `06e2be4`, `f3cba13`, `1c30c96`, `e22cde0`, `14ed42d`

---

## Sprint 2 — Frameworks — Unidad II — 2026-09-03 al 2026-09-17

### 2026-09-08 · 1 h

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit (`cba51e9`)

**Actividad**

Corrección de seguridad de alcance por sede (`cba51e9`): `membresias.service.ts` y `pagos.service.ts` dejan de devolver datos de todas las sedes a un recepcionista sin `sedeId` y responden 403 explícito. Se agrega la pantalla `SinSedeAsignada.tsx` con redirección desde `ProtectedRoute`, se construye `/admin/membresias` con filtros por estado y sede (antes era un enlace roto), se ajusta el ADR de alcance por sede y se versionan en el repositorio el esquema de base de datos y el trigger de auditoría.

**Decisión**

Denegar por defecto (fail-closed) cuando el usuario no tiene sede asignada, en lugar de mostrar todas las sedes.

**Problema o bloqueo**

Dos servicios (membresías y opciones de cobro en efectivo) tenían el mismo patrón fail-open: ante un recepcionista sin sede asignada devolvían datos de todas las sedes en vez de ninguno (`docs/LOG.md` y mensaje de `cba51e9`). Se corrigió en ambos con el mismo criterio. Además, el esquema de la base y el trigger de auditoría solo existían aplicados en Supabase, sin respaldo en el repositorio; el mismo commit los versionó.

**Commits**

- `cba51e9`

---

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-09-30 · 4 h

**Tarjeta(s) Jira:** según `docs/bitacoras/LOG-retamoso.md`, `f4bbfdc` se relaciona con FT1-37. Los commits `a846741`, `4f3a75a`, `f55e1c9` y `70511b0`: sin tarjeta citada en el commit.

**Actividad**

Verificación de correo obligatoria antes de poder iniciar sesión, con reenvío limitado por tasa y mensaje distinguible en el login; el chequeo de membresía activa para socios se movió del registro al login. Rediseño del área de Socio (dashboard, "Mi cuenta", endpoint `PATCH /usuarios/:id/foto`), QR de ingreso con código corto de 6 dígitos, lector de QR con cámara y correcciones previas a producción (`f4bbfdc`). Ese mismo día: `a846741` (atributos de la cookie), `4f3a75a` (`vercel.json`) y `f55e1c9` y `70511b0` (corrección visual de `MiQr.tsx`).

**Decisión**

Mover el chequeo de membresía del registro al login, porque el registro ya no inicia sesión de inmediato. Para la condición de carrera del último cupo de una clase, un repositorio con transacción y bloqueo pesimista, el mismo patrón que ya se usaba para canchas.

**Problema o bloqueo**

El mensaje de `f4bbfdc` registra cinco problemas y su solución: una regresión en el chequeo de membresía de los socios al dejar de iniciar sesión el registro; una condición de carrera real al reservar el último cupo de una clase con dos solicitudes simultáneas (se resolvió con transacción y bloqueo pesimista); una escalación de privilegios en `PATCH /usuarios/:id`, que aceptaba `tipoActor`, `sedeId` y `dni` en el cuerpo (se cerró y el DNI pasó a un endpoint dedicado solo para el Gerente); la ausencia de timeout en Axios, que causaba carga infinita ante fallos de red; y la cookie JWT, que en producción exige `secure` y `sameSite: none` por usar dominios distintos (Vercel y Render) y en desarrollo `lax` sin `secure`. En `a846741` los atributos de la cookie quedaron en un solo lugar (`opcionesCookie`), usado por el login y el logout. `4f3a75a` agregó a `vercel.json` un rewrite de `/api` hacia el backend en Render. `f55e1c9` y `70511b0` corrigen la pantalla del QR; los mensajes no detallan la causa.

**Commits**

- `f4bbfdc`, `a846741`, `4f3a75a`, `f55e1c9`, `70511b0`

---

## Sprint 5 — Testing y CI/CD — Unidad V — 2026-10-29 al 2026-11-12

### 2026-10-29 · 1 h

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit (`ac9c961`, `a0c3e5b`)

**Actividad**

Pruebas unitarias del servicio de acceso (`ac9c961`): generación y validación de QR por token y por código corto, regla RN-01 (un segundo ingreso con sesión abierta responde 409), aforo, alcance por sede y egreso; informe `docs/testing/informe-auditoria-testing.md`. Pipeline de GitHub Actions (`a0c3e5b`): instalación, verificación de tipos, pruebas con informe de cobertura y compilación del servidor, y compilación del cliente, en cada push y pull request a `main`.

**Decisión**

Documentar con pruebas dos comportamientos pendientes de corregir, en lugar de ocultarlos (mensaje de `ac9c961`): el error de índice único (23505) sin traducir a 409 y el token QR reutilizable dentro de su vigencia.

**Problema o bloqueo**

Esas dos fallas son el hallazgo de la entrada. Según `docs/bitacoras/LOG-retamoso.md` (entrada del 2026-11-09, FT1-59 y FT1-64), el token de un solo uso y la traducción del 23505 a 409 los aplicó Máximo en `009914b` y `c2d8e0e`. El informe de testing de la misma fecha señala además que el servicio de acceso tenía cobertura baja y que ninguna prueba usaba base de datos real, y que no existía CI hasta `a0c3e5b`.

**Commits**

- `ac9c961`, `a0c3e5b`
- Del equipo, relacionados con la tarea: `009914b`, `c2d8e0e`

---

### 2026-11-09 (18:18) · 2 h

**Tarjeta(s) Jira:** FT1-64 y FT1-87 (citadas en `3abeccf`). `cd24628`: sin tarjeta citada en el commit (cita `[FT1-nn]`). Sprint: `docs/bitacoras/LOG-retamoso.md` ubica FT1-64 en el sprint 5.

**Actividad**

Endurecimiento del acceso y CI (`3abeccf`): `JwtStrategy` rechaza los tokens de tipo `qr-acceso` como sesión (`jwt.strategy.ts`, con 46 líneas de pruebas nuevas en `jwt.strategy.spec.ts`), el código corto usa `randomInt` de `crypto` en `acceso.service.ts`, y Node 22 en `ci.yml` y en los Dockerfiles de `backend/` y `frontend/`. Antes, `cd24628` había subido Node a 22 en la CI por el requisito de supabase-js. `a566405` repite el mismo mensaje y la misma hora.

**Decisión**

Un QR firmado no debe poder usarse como cookie de sesión: se valida el tipo del token en la estrategia. El código corto pasa a generarse con un generador criptográfico.

**Problema o bloqueo**

El token del QR de acceso (60 s) se firma con el mismo secreto que la sesión, por lo que `JwtStrategy` lo aceptaba como sesión (comentario en `jwt.strategy.ts`); se rechaza el tipo `qr-acceso` sin consultar al usuario. El código corto se generaba con `Math.random`, que no es criptográfico (diff de `acceso.service.ts`). Las pruebas nuevas de `jwt.strategy.spec.ts` cubren el rechazo.

**Commits**

- `3abeccf`, `cd24628`

---

## Sprint 7 — Integración — Unidad Cierre — 2026-11-05 al 2026-11-19

Las entradas siguientes son del 2026-11-09. Ningún commit ni documento del repositorio asigna sprint a las tarjetas FT1-105 a FT1-110; se usa el sprint 7 por ser el que, según `docs/bitacoras/LOG-retamoso.md`, registra el trabajo de integración de ese día.

### 2026-11-09 (11:26) · 1,5 h

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit (`5885c68` y `1eec536` citan `[FT1-nn]` sin número). `docs/bitacoras/LOG-retamoso.md` relaciona `1eec536` con FT1-95 a FT1-104.

**Actividad**

Ingreso manual por DNI para recepción con previsualización y auditoría (`5885c68`): endpoints `POST /acceso/buscar-dni` y `POST /acceso/validar-dni` con `validar-dni.dto.ts`, modo DNI en `ControlAcceso.tsx` y `acceso-dni.spec.ts` (442 líneas). El mismo commit agrega `docs/entregables/auditoria-estado-entrega.md`. Después, `1eec536` adaptó la estructura del repositorio a los lineamientos de entrega (`server/` a `backend/`, `client/` a `frontend/`).

**Decisión**

Implementado en el código: el ingreso por DNI pasa por la misma lógica que el QR y el código corto (`registrarIngresoValidado`: sede, vigencia, aforo y RN-01) y queda auditado como `INGRESO_MANUAL_DNI`. La previsualización devuelve solo nombre, apellido, foto y estado de la membresía y no registra nada. Un DNI inexistente y el de alguien que no es socio dan el mismo 404, para que la búsqueda no revele datos de otros tipos de usuario. Los endpoints están limitados a 20 y 30 peticiones por minuto y solo para Recepcionista, Gerente de Sede y Gerente General.

**Problema o bloqueo**

`docs/bitacoras/LOG-retamoso.md` (entrada del 2026-11-09, FT1-59 y FT1-64) registra que esa versión chocó con el endurecimiento de Máximo del mismo día: se conservó la de Martín y se volvió a aplicar el endurecimiento sobre su código. Allí se vio que el 23505 se traducía a 409 solo en el ingreso por DNI (`validarDni`, como muestra el diff de `5885c68`) y que con QR y con código seguía saliendo 500.

**Commits**

- `5885c68`, `1eec536`

---

### 2026-11-09 (19:46) · 2 h

**Tarjeta(s) Jira:** FT1-105, FT1-106 y FT1-107

**Actividad**

Base del acceso sin conexión en el backend (`9b9529e`): servicio `claves-qr.service.ts` que firma el QR con ES256 (clave P-256 por configuración, `kid` en el encabezado, con las variables documentadas sin valores en `.env.example`), migración `012-acceso-offline.sql` con su reversión `.down.sql`, entidad `evento-acceso-offline` y columnas nuevas en `control-acceso`, y endpoints de clave pública y de snapshot, con `swagger.json` regenerado. Pruebas en `acceso-offline.spec.ts` (554 líneas).

**Decisión**

Firma asimétrica del QR (ES256) en lugar de HS256 para que el terminal pueda verificarlo sin conexión con solo la clave pública. Sin clave configurada se sigue firmando con HS256 y el acceso offline no queda disponible (comentarios de `.env.example`). La migración es aditiva: solo agrega columnas con valor por defecto y una tabla, de modo que el código anterior sigue funcionando con ella aplicada. Los ADR-003 y ADR-007 en `docs/adr/` tratan la estrategia offline.

**Problema o bloqueo**

Al firmar, `@nestjs/jwt` prefiere el `secret` del módulo (HS256) sobre `privateKey`; para no tocar el `JwtModule`, la firma ES256 pasa el `secret` en cada llamada (comentario en `acceso.service.ts`). Además, en variables de entorno el PEM suele llegar en una línea con `\n` literales, y `claves-qr.service.ts` lo normaliza. Antes de este commit, `docs/entregables/auditoria-estado-entrega.md` registraba que el acceso offline no existía y que solo había columnas sin uso.

**Commits**

- `9b9529e`

---

### 2026-11-09 (19:58) · 0,5 h

**Tarjeta(s) Jira:** FT1-108

**Actividad**

Endpoint de sincronización de ingresos offline (`59218ce`): `POST /acceso/sincronizar` con `sincronizar-acceso.dto.ts`, procesamiento por evento en su propia transacción, resultados `CREADO`, `OBSERVADO`, `CONFLICTO` y `RECHAZADO`, y traducción de las violaciones de índice único (23505) mediante `restriccionViolada` en `db-errors.helper.ts`. Pruebas unitarias en `acceso-sincronizacion.spec.ts` (764 líneas) y de integración contra PostgreSQL en `acceso-sincronizacion.int-spec.ts` (212 líneas), con `swagger.json` actualizado.

**Decisión**

Una transacción por evento, y primero se registra el evento y después el ingreso, para que los índices únicos detecten el QR reusado (`jti`) y la sesión abierta. Idempotencia por identificador de evento del cliente: un evento ya procesado devuelve lo guardado.

**Problema o bloqueo**

Un 23505 aborta la transacción en curso, por lo que el resultado del evento se registra en una transacción nueva y corta; si en el medio otro proceso tomó el `jti`, se guarda sin él, y si ganó el mismo identificador de evento se devuelve lo de ese (comentarios de `acceso.service.ts`). Los rechazos y conflictos no reservan el `jti`, para que otro evento válido del mismo QR no quede bloqueado por un envío mal formado.

**Commits**

- `59218ce`

---

### 2026-11-09 (20:07 a 20:29) · 2 h

**Tarjeta(s) Jira:** FT1-109 (los tres commits) y FT1-69 (`458a14c`)

**Actividad**

Frontend del acceso sin conexión en tres commits. `458a14c`: verificación ES256 del QR en el navegador (`verificarQr.ts`), almacén IndexedDB (`almacenOffline.ts`) y configuración de Vitest con jsdom. `b3b10d5`: el arranque conserva la sesión ante un fallo de red o un servidor caído, con una copia local solo de los campos del usuario, sin tokens (`sesionLocal.ts`, `AuthContext.tsx`). `281446f`: descarga de snapshot (`snapshot.ts`), cola de ingresos con sincronización por lotes (`colaIngresos.ts`) y hook `useModoOffline`. Cada módulo tiene su archivo de pruebas.

**Decisión**

La sesión sigue siendo la cookie httpOnly del backend: la copia local no guarda credenciales ni tokens y vence a las 24 horas (`VIGENCIA_COPIA_MS` en `sesionLocal.ts`), de modo que el terminal pueda abrir sin red sin debilitar la sesión real. Un 401 o 403 sigue cerrando la sesión.

**Problema o bloqueo**

Hasta `b3b10d5`, el arranque de `AuthContext.tsx` cerraba la sesión ante cualquier fallo al consultar al servidor (`.catch(() => aplicarUsuario(null))`), así que un terminal sin red no podía abrir la app. El commit distingue la falta de respuesta (red, timeout, 5xx) de una respuesta de sesión inválida (`decidirTrasFalloAlArrancar` en `clasificarError.ts`) y hace que el interceptor de Axios nunca cierre la sesión por un error de red. Con la sesión sin verificar se reintenta al volver la conexión y cada 30 s.

**Commits**

- `458a14c`, `b3b10d5`, `281446f`

---

### 2026-11-09 (20:35) · 0,5 h

**Tarjeta(s) Jira:** FT1-110

**Actividad**

Integración del modo sin conexión en la pantalla de control de acceso (`000cdc7`): `ControlAcceso.tsx` usa `useModoOffline`, descarga el snapshot al abrir y lo renueva si tiene más de una hora, valida el QR localmente sin conexión, muestra el aviso de modo sin conexión con "Sincronizar ahora", el resumen de la última sincronización y la insignia "Sin conexión". Las decisiones y los textos están en funciones puras en `decisionesPantalla.ts`, con 30 pruebas en `decisionesPantalla.test.ts`.

**Decisión**

Pasar a validación local solo ante falta de respuesta, timeout o error 5xx; un 4xx del servidor se muestra como rechazo real (comentarios de `ControlAcceso.tsx`). Ingreso por código, por DNI y egreso quedan deshabilitados sin conexión, con un texto que lo explica.

**Problema o bloqueo**

Antes de este commit, la pantalla bloqueaba toda validación sin conexión: mostraba "Sin conexión a internet" y el texto de que se requiere conexión (`docs/entregables/auditoria-estado-entrega.md`, informe de acceso offline). Sin bloqueos adicionales registrados en el historial.

**Commits**

- `000cdc7`

---

## Trabajo previo o entre sprints

Las fechas siguientes caen fuera de las ventanas de sprint documentadas en `docs/bitacoras/LOG-retamoso.md`.

### 2026-08-29 · 1,5 h

**Tarjeta(s) Jira:** según `docs/bitacoras/LOG-retamoso.md` y `docs/LOG.md`, `1802fc4` se relaciona con FT1-22 (el commit no la cita). Fecha entre el sprint 1 (termina el 2026-08-27) y el sprint 2 (empieza el 2026-09-03).

**Actividad**

Sistema de auditoría (`1802fc4`): módulo con interceptor global `@Auditable` y trigger de Postgres sobre la tabla de pagos, que registra acciones sensibles en las 9 entidades principales. En el mismo commit: corrección del fallo de `GET /clases/:id/reservas` por falta de `relations`, prevención de membresías duplicadas tras un pago rechazado con `PATCH /membresias/:id/cancelar`, flujo de renovación (`POST /membresias/renovar`), indicador `simularRechazo` en la pasarela simulada para QA y manejo del duplicado de reserva de clase con `ConflictException`.

**Decisión**

Auditoría en dos capas: el interceptor aporta el contexto de la aplicación y el trigger cubre los cambios directos sobre pagos (ADR-017 en `docs/adr/`).

**Problema o bloqueo**

El mensaje de `1802fc4` registra: `GET /clases/:id/reservas` fallaba por falta de `relations` (la clase no venía poblada); reintentar tras un pago rechazado creaba membresías duplicadas; un duplicado de reserva de clase dejaba pasar el error crudo de Postgres; el dashboard del socio no distinguía un error de red de "sin membresía activa"; y la pantalla de completar membresía navegaba como éxito con el pago rechazado. Todos se corrigieron en el mismo commit. Según `docs/bitacoras/LOG-retamoso.md` (FT1-22), el detalle JSON de la auditoría guardaba tokens, y se agregó redacción automática de secretos; el script `008-redactar-secretos-auditoria.sql` llegó en `26dfa17`.

**Commits**

- `1802fc4`

---

### 2026-10-09 · 1,5 h

**Tarjeta(s) Jira:** según `docs/bitacoras/LOG-retamoso.md`, `26dfa17` se relaciona con FT1-40 y FT1-42; según `docs/LOG.md` (entrada de Teo Ava), con FT1-38. El commit no cita tarjeta. Fecha posterior al sprint 4 (termina el 2026-10-08).

**Actividad**

Notificaciones y gestión (`26dfa17`): sistema de notificaciones por panel y correo con patrón Factory para los canales y Observer para los eventos, campanita para el Socio, sección de envíos para el Gerente General con vista previa, confirmación e historial, promoción de la lista de espera que ahora notifica, script `006-notificaciones.sql`, configuración de clases (edición, cambio de instructor, regeneración de fechas, baja con aviso) y cobro presencial de canchas por el Recepcionista (`POST /pagos/efectivo/cancha`) con precio calculado en el servidor. Ese mismo día, `4533a9f` eliminó un script auxiliar.

**Decisión**

Factory para los canales de notificación y Observer para los eventos; el precio del cobro presencial se calcula en el servidor (ADR-016).

**Problema o bloqueo**

El script `server/scripts/listar-endpoints.ts`, agregado en `26dfa17` para auditar los endpoints, alteraba la estructura de `dist` en el build; `4533a9f` lo eliminó. El mensaje de `26dfa17` declara además que las consultas SQL escritas a mano y los bloqueos reales no se probaron contra Postgres; el informe `docs/testing/informe-auditoria-testing.md` (2026-10-29) confirma que ninguna prueba usaba base de datos real.

**Commits**

- `26dfa17`, `4533a9f`

---

### 2026-10-12 · 1,5 h

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit (`a72b7ef`, `ddeb86f`). Fecha entre el sprint 4 (termina el 2026-10-08) y el sprint 6 (empieza el 2026-10-22).

**Actividad**

Abstracción del transporte de correo (`a72b7ef`): interfaz `EnviadorCorreo` con `BrevoEnviador` (API HTTPS, timeout de 10 s) para producción y `GmailSmtpEnviador` para desarrollo, elegidos con `MAIL_PROVIDER`, validación de configuración al arrancar y logs que registran solo estado y código. Con tests de Brevo (éxito, 400/401, timeout, red) y de selección de proveedor. Luego, refactor de `NotificadorFactory` por registro de canales con el token `NOTIFICADORES` (`ddeb86f`), con tests de extensibilidad, de la fábrica y del grafo de inyección del módulo.

**Decisión**

Cambiar a una API HTTPS porque, según el mensaje de `a72b7ef`, Render bloquea el SMTP saliente. La fábrica deja de conocer clases concretas para que agregar un canal solo requiera una clase y su registro.

**Problema o bloqueo**

El envío de correo fallaba en producción con `ETIMEDOUT`: Render bloquea el SMTP saliente, de modo que la conexión por SMTP no llegaba al servidor de correo (mensaje de `a72b7ef`). Dos días antes, `27102e5` (2026-10-10) había agregado al log el código técnico del error (`err.code`, `err.responseCode`, `err.command` y la demora en caso de timeout) para distinguir un bloqueo de red, credenciales inválidas o variables faltantes en producción, sin registrar direcciones ni credenciales. La solución fue enviar por la API HTTPS de Brevo, con un timeout de 10 s (`BREVO_TIMEOUT_MS`) que aborta la llamada y falla con `ETIMEDOUT` sin exponer la clave de la API (prueba en `brevo.enviador.spec.ts`), y dejar el SMTP de Gmail solo para desarrollo.

**Commits**

- `a72b7ef`, `ddeb86f`, `27102e5`

---

### 2026-10-18 · 8 h

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit (`73bbf51`, `ad8d386`, `8963659`, `65ecc2d`, `fadb12b`, `34a9ca9`). `8963659` figura en `docs/adr/ADR-011-pwa-en-lugar-de-app-nativa.md`, sin tarjeta. Fecha entre el sprint 4 (termina el 2026-10-08) y el sprint 6 (empieza el 2026-10-22).

**Actividad**

Vigencia de membresías por fechas (`73bbf51`, adaptada en el cliente por `ad8d386`): función central de vigencia usada por acceso, reservas, precios, pagos, clientes y reportes; una compra con membresía vigente queda como próxima y empieza al terminar la anterior (máximo una vigente y una próxima); `fecha_fin` exclusiva con fechas en hora de Argentina; alta con bloqueo de fila por usuario y error de exclusión de Postgres traducido a 409. Cliente como PWA instalable (`8963659`) con service worker que solo precachea archivos estáticos y deja las llamadas a la API siempre por red. Manejo de errores de carga y de falta de conexión (`65ecc2d`). Canal push con Web Push y claves VAPID (`fadb12b`, `34a9ca9`), deshabilitado si no hay claves configuradas.

**Decisión**

Service worker sin caché de la API y push opcional por configuración, según los mensajes de `8963659` y `fadb12b`. La vigencia se documenta en ADR-022.

**Problema o bloqueo**

El mensaje de `65ecc2d` registra el problema: una carga fallida se mostraba como "sin membresía" o "sin datos", y en la reserva de canchas, si fallaba la consulta de ocupación del día, se mostraban todos los horarios como libres. Se resolvió con un estado de error con motivo y botón "Reintentar", reintento automático al volver la conexión, un banner global de "Sin conexión a internet" y el bloqueo de la grilla de reserva cuando falla la ocupación. Mi QR no se muestra ni se regenera sin conexión. `73bbf51` resuelve a nivel de base la superposición de membresías con el bloqueo de fila y la traducción a 409 del error de exclusión de Postgres.

**Commits**

- `73bbf51`, `ad8d386`, `8963659`, `65ecc2d`, `fadb12b`, `34a9ca9`

---

## Sprint 8 — Demo Day — Unidad Cierre — 2026-11-19 al 2026-12-03

_Sprint todavía no iniciado._

---
