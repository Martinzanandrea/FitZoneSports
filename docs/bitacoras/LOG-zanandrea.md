# Bitácora — Zanandrea, Martín — Rol: Arquitecto y Backend Lead (P1; asumo también las tareas del P2)

**Cómo calculé las horas.** Son estimaciones a partir de los horarios de mis commits. Por cada fecha ordeno mis commits (sin merges) por hora local, sumo los intervalos entre commits consecutivos de 90 minutos o menos, sumo 30 minutos por cada commit como trabajo previo y redondeo a media hora, con mínimo de 0,5 h. Cuando una entrada reúne varias fechas, sumo las horas de cada fecha. Solo cuento commits de esa fecha, aunque la entrada mencione otros. `a566405` no se cuenta porque repite el mensaje y la hora de `3abeccf`.

**Sprints.** Uso las ventanas de la planificación del equipo (`docs/planificacion`): S1 13/08–27/08, S2 03/09–17/09, S3 15/09–24/09, S4 15/09–08/10, S5 09/10–22/10, S6 23/10–05/11, S7 06/11–19/11 y S8 23/11–29/11. Ubico cada entrada por su fecha. Cuando el trabajo de la entrada corresponde a otra unidad que la del sprint, lo digo en la propia entrada.

Usuario de Git: `martin` y `Martin Zanandrea` (mismo correo).

## Sprint 1 — Arquitectura — Unidad I — 2026-08-13 al 2026-08-27

### 2026-08-21 · 4,5 h

**Tarjeta(s) Jira:** los commits no citan tarjeta. Por su contenido se relacionan con FT1-37, FT1-40 y FT1-42 (`7862d54`) y con FT1-9 y FT1-16 (`e22cde0`). Esas tarjetas están asignadas a Máximo, que definió y probó las reglas; la implementación de los módulos es mía.

**Actividad**

Construí el backend con NestJS y TypeORM. Creé los módulos y las entidades (`7862d54`, 15/08), los módulos de usuarios, clases, instructores y membresías (`5552f69`, 20/08) y la lógica de negocio de canchas (`cdca2b6`, 20/08). El 21/08 implementé la pasarela de pagos simulada, el pago en efectivo y los comprobantes (`06e2be4`) y cerré y desplegué el backend (`f3cba13`, `1c30c96`). Según `docs/LOG.md`, quedaron 13 módulos con Swagger.

**Decisión**

Elegímos un monolito modular con NestJS y PostgreSQL (`e22cde0`, 24/08; [ADR-001](../adr/ADR-001-estilo-arquitectonico.md) y [ADR-002](../adr/ADR-002-motor-de-base-de-datos.md)). Lo que inclinó la decisión fue que la regla RN-02 (dos reservas simultáneas de la misma cancha) necesita transacciones con garantías ACID, y que somos tres personas y un solo despliegue. Usé NestJS por su contenedor de inyección de dependencias y TypeORM como ORM ([ADR-005](../adr/ADR-005-framework-backend-ioc-orm.md)), y una pasarela de pagos simulada que devuelve solo un token, sin datos de tarjeta ([ADR-010](../adr/ADR-010-medios-de-pago-y-tokenizacion.md)).

**Problema o bloqueo**

El límite global de peticiones estaba en 20 por minuto y producía errores 429 en el uso normal; lo subí a 200 por minuto y mantuve 5 por minuto en el login. El 07/09 (`14ed42d`) dejé un comentario en `auth.controller.ts` porque el límite de intentos del login no se aplicaba: el endpoint aceptaba POST sin límite. Sospeché de la versión de TypeScript y dejé el problema registrado; mi commit no lo resuelve. Lo resolvió Teo 26 minutos después en `9abc4b1`, quitando un `@SkipThrottle()` que había en `auth.controller.ts`.

**Commits**

- `7862d54`, `5552f69`, `cdca2b6`, `06e2be4`, `f3cba13`, `1c30c96`, `e22cde0`, `14ed42d`

---

## Sprint 2 — Frameworks — Unidad II — 2026-09-03 al 2026-09-17

### 2026-09-08 · 1 h

**Tarjeta(s) Jira:** no citada en el commit (`cba51e9`, `09d6469`)

**Actividad**

Corregí el alcance por sede (`cba51e9`). `membresias.service.ts` y `pagos.service.ts` dejaron de devolver datos de todas las sedes a un recepcionista sin `sedeId` y ahora responden 403. Agregué la pantalla `SinSedeAsignada.tsx` con redirección desde `ProtectedRoute`, armé `/admin/membresias` con filtros por estado y sede (antes era un enlace roto) y ajusté el ADR de modelado de datos. El día anterior (07/09, `09d6469`) había versionado en el repositorio el esquema de la base y el trigger de auditoría.

**Decisión**

Denegar por defecto (fail-closed) cuando el usuario no tiene sede asignada, en lugar de mostrar todas las sedes.

**Problema o bloqueo**

Encontré el mismo patrón fail-open en dos servicios (membresías y opciones de cobro en efectivo): ante un recepcionista sin sede devolvían datos de todas las sedes. Corregí ambos con el mismo criterio. Además, el esquema y el trigger de auditoría solo existían aplicados en Supabase, sin respaldo en el repositorio, y los versioné en `09d6469` (`001-schema-base.sql` y `002-auditoria-tabla-y-trigger.sql`).

**Commits**

- `cba51e9`, `09d6469` (07/09)

---

### 2026-09-09 y 2026-09-10 · 1,5 h

**Tarjeta(s) Jira:** no citada en los commits (`7a06627`, `cd3f63b`)

**Actividad**

Rediseñé las clases grupales como plantillas semanales recurrentes en lugar de eventos únicos (`7a06627`): nuevas entidades `FranjaHoraria`, `ClaseHorarioSemanal` y `ClaseOcurrencia` (17 entidades en total), un servicio que reparte las horas semanales entre los días con redondeo a media hora y genera ocurrencias reservables con una ventana móvil de 4 semanas por cron. En el mismo commit validé la membresía activa (RN-03) al reservar y audité los 9 ADR existentes. Al día siguiente agregué paginación a los listados de acceso, administración, auditoría, canchas, clases, instructores, membresías, pagos, sedes y usuarios (`cd3f63b`), con `PaginationQueryDto` y un tipo `PaginatedResponse` común.

**Decisión**

Modelar la clase como una plantilla que genera ocurrencias, porque una clase real se repite todas las semanas y reservar "una clase" en realidad significa reservar una de sus ocurrencias; el modelo de evento único no permitía listas de espera ni cupos por fecha. Dejé constancia en [ADR-018](../adr/ADR-018-clases-recurrentes.md) y el cambio del modelo (17 entidades) en [ADR-013](../adr/ADR-013-modelado-de-datos.md).

**Problema o bloqueo**

El rediseño dejó referencias a columnas que ya no existían (`Clase.horarioInicio`). No las detecté en ese momento: salieron recién el 16/09, cuando comprobé que el resumen del dashboard fallaba el 100 % de las veces (ver la entrada de esa fecha). La lección fue que cambiar un modelo exige revisar todas las consultas que lo usan, y que en ese momento no teníamos pruebas que lo detectaran.

**Commits**

- `7a06627`, `cd3f63b`

---

## Sprint 3 — Patrones — Unidad III — 2026-09-15 al 2026-09-24

### 2026-09-15 y 2026-09-16 · 2,5 h

**Tarjeta(s) Jira:** no citada en los commits (`2c6c8d7`, `e13d904`, `d5c7d19`, `23cf2ff`)

**Actividad**

Corregí los errores de los patrones Observer, Repository y listener (`2c6c8d7`) y refactoricé tres patrones (`23cf2ff`). Pasé Strategy (precio de canchas) a inyección polimórfica por token, en lugar de un if/else sobre clases concretas. Separé Repository (reservas sin sobreventa) en una interfaz y una implementación en memoria para poder probarlo después. Extraje a constantes compartidas los nombres del evento del Observer (lista de espera de clases). En el mismo commit validé el tipo y el tamaño real de los archivos subidos, pedí la contraseña actual para cambiarla y corregí el cálculo de ingresos y el resumen del dashboard.

**Decisión**

Registrar las estrategias de precio bajo el token `PRICING_STRATEGIES`, de modo que el calculador reciba la lista por inyección y aplique las que declaran `aplica()`. Así agregar una regla de precio nueva es una clase nueva y su registro, sin tocar las existentes (principio abierto/cerrado). El Repository con interfaz evita acoplar la lógica de reservas a TypeORM y permite probarla con dobles.

**Problema o bloqueo**

`GET /admin/dashboard/resumen` fallaba el 100 % de las veces porque referenciaba una columna eliminada en el rediseño de clases recurrentes (`Clase.horarioInicio` pasó a `ClaseOcurrencia.fecha`), y el cálculo de ingresos tenía un join roto hacia una relación que ya no existía; corregí ambos. También detecté un fail-open en tres pantallas (`GestionReservasClases`, `GestionReservasCanchas`, `ControlAcceso`): un Gerente, que tiene `sedeId` nulo por ver todas las sedes, quedaba bloqueado por el chequeo pensado solo para un Recepcionista sin sede. Distinguí los dos casos.

**Commits**

- `2c6c8d7`, `e13d904`, `d5c7d19`, `23cf2ff`

---

### 2026-09-23 · 0,5 h

**Tarjeta(s) Jira:** no citada en el commit (`9f46ceb`)

**Actividad**

Armé la landing pública de varias páginas (`/`, `/clases`, `/canchas`, `/sedes`, `/nosotros`) y rediseñé el área de Socio (`9f46ceb`). En el backend agregué tres endpoints públicos: `GET /canchas/publico`, `GET /clases/publico` y la extensión de `GET /sedes/publico`, que no exponen disponibilidad ni horarios puntuales. Reemplacé las estadísticas inventadas por datos reales de la API pública.

**Decisión**

Los endpoints públicos devuelven solo catálogo y resúmenes agregados, no disponibilidad de reservas ni instructores puntuales, para no filtrar datos operativos sin sesión.

**Problema o bloqueo**

Las rutas `/clases` y `/canchas` chocaban entre la landing pública y las pantallas de reserva del Socio. Lo resolví mostrando el catálogo público sin sesión y la pantalla real de reserva cuando hay sesión activa.

**Commits**

- `9f46ceb`

---

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-09-30 · 4 h

**Tarjeta(s) Jira:** `f4bbfdc` se relaciona con FT1-37 (asignada a Máximo, que probó el módulo de acceso; la implementación es mía). `a846741`, `4f3a75a`, `f55e1c9` y `70511b0` no citan tarjeta.

**Actividad**

Hice obligatoria la verificación de correo antes de iniciar sesión, con reenvío limitado por tasa, y moví el chequeo de membresía activa del registro al login. Rediseñé el área de Socio (dashboard, "Mi cuenta", `PATCH /usuarios/:id/foto`), agregué el QR de ingreso con código corto de 6 dígitos y el lector de QR con cámara, y corregí problemas previos a producción (`f4bbfdc`). Ese mismo día: atributos de la cookie (`a846741`), `vercel.json` (`4f3a75a`) y la pantalla del QR (`f55e1c9`, `70511b0`).

**Decisión**

Mover el chequeo de membresía al login porque el registro ya no inicia sesión de inmediato. Para el último cupo de una clase usé un repositorio con transacción y bloqueo pesimista, el mismo patrón que ya usaba la reserva de canchas ([ADR-004](../adr/ADR-004-concurrencia-en-reservas.md)).

**Problema o bloqueo**

El mensaje de `f4bbfdc` registra cinco problemas que resolví: una regresión del chequeo de membresía al dejar de iniciar sesión el registro; una condición de carrera real al reservar el último cupo con dos solicitudes simultáneas (transacción y bloqueo pesimista); una escalación de privilegios en `PATCH /usuarios/:id`, que aceptaba `tipoActor`, `sedeId` y `dni` en el cuerpo (la cerré y el DNI pasó a un endpoint dedicado para el Gerente); la ausencia de timeout en Axios, que dejaba la carga infinita ante fallos de red; y la cookie JWT (autenticación por cookie httpOnly, [ADR-014](../adr/ADR-014-autenticacion-y-autorizacion.md)), que en producción exige `secure` y `sameSite: none` por usar dominios distintos (Vercel y Render). En `a846741` dejé esos atributos en un solo lugar (`opcionesCookie`). En `4f3a75a` agregué a `vercel.json` un rewrite de `/api` hacia Render.

**Commits**

- `f4bbfdc`, `a846741`, `4f3a75a`, `f55e1c9`, `70511b0`

---

### 2026-10-07 y 2026-10-08 · 1,5 h

**Tarjeta(s) Jira:** no citada en los commits (`c3e4f75`, `6e4ed9a`)

**Actividad**

Implementé la jerarquía de roles (`c3e4f75`): Gerente General, Gerente de Sede y Recepcionista, con las migraciones 004 y 005, y el alcance por sede que falla cerrado también en el WHERE de listados y reportes. Agregué el flujo en que un Externo pasa a Socio al aprobarse el pago de una membresía, dentro de la misma transacción. Al día siguiente (`6e4ed9a`) sincronicé la sesión entre pestañas con `BroadcastChannel` y manejé el vencimiento del JWT.

**Decisión**

Un Externo se convierte en Socio dentro de la transacción del pago y un pago rechazado no cambia el rol, para que no queden roles inconsistentes ante un corte ([ADR-020](../adr/ADR-020-jerarquia-de-roles.md) y [ADR-015](../adr/ADR-015-flujo-membresia-y-pago.md)). La señal entre pestañas viaja solo como evento; nunca viaja el token.

**Problema o bloqueo**

Al reservar una clase, PostgreSQL devolvía un error 500 porque el bloqueo `FOR UPDATE` se aplicaba sobre un `LEFT JOIN`, cosa que rechaza; lo resolví bloqueando solo la ocurrencia (`FOR UPDATE OF oc`) y agregué un test. El 08/10 corregí otro error: con dos usuarios distintos en el mismo navegador, la cookie compartida quedaba con el último login mientras la otra pestaña conservaba al usuario anterior en memoria, y esa pestaña mostraba sesión iniciada pero recibía 403 en todo. Además la cookie vencía a las 8 horas fijas en lugar de junto con el JWT; ahora su duración sale de `JWT_EXPIRATION`. Dejé anotado como pendiente conocido que la membresía se crea como ACTIVA antes del pago, por lo que un corte entre ambos pasos deja una membresía huérfana.

**Commits**

- `c3e4f75`, `6e4ed9a`

---

## Sprint 5 — Testing y CI/CD — Unidad V — 2026-10-09 al 2026-10-22

En este sprint el trabajo de código fue de funcionalidades y de PWA (que corresponde a la Unidad VI). Las pruebas del acceso y el pipeline de CI quedaron para el 29/10 (ver el Sprint 6).

### 2026-10-09 · 1,5 h

**Tarjeta(s) Jira:** `26dfa17` no cita tarjeta; por su contenido se relaciona con FT1-40 y FT1-42 (asignadas a Máximo) y con FT1-38 (asignada a Teo, según `docs/LOG.md`). `98f7645` y `4533a9f` tampoco.

**Actividad**

Implementé el sistema de notificaciones por panel y correo (`26dfa17`), con Factory para los canales y Observer para los eventos, la campanita del Socio y la sección de envíos del Gerente General. Agregué la configuración de clases (edición, cambio de instructor, regeneración de fechas, baja con aviso) y el cobro presencial de canchas por el Recepcionista (`POST /pagos/efectivo/cancha`) con precio calculado en el servidor. En `98f7645` hice que una reserva de clase cancelada se reactive en la misma transacción en lugar de devolver 409.

**Decisión**

El monto del cobro presencial lo calcula el servidor y no el cliente ([ADR-016](../adr/ADR-016-montos-calculados-en-servidor.md)). La reserva cancelada se reactiva en lugar de crear otra fila, para respetar la restricción única de usuario y ocurrencia sin dejar la reserva imposible de repetir.

**Problema o bloqueo**

Volver a reservar una clase cancelada daba 409 por la restricción única; lo resolví reactivando la reserva dentro de la misma transacción, con el mismo bloqueo pesimista y el mismo cálculo de cupo y lista de espera. Además, el script `listar-endpoints.ts`, que agregué en `26dfa17` para auditar los endpoints, alteraba la estructura de `dist` en el build, y lo eliminé en `4533a9f`. Dejé declarado en `26dfa17` que las consultas SQL escritas a mano y los bloqueos reales no estaban probados contra Postgres; eso quedó abierto hasta que sumamos las pruebas de integración.

**Commits**

- `26dfa17`, `98f7645`, `4533a9f`

---

### 2026-10-10 y 2026-10-12 · 2 h

**Tarjeta(s) Jira:** no citada en los commits (`27102e5`, `a72b7ef`, `ddeb86f`)

**Actividad**

Abstraje el transporte de correo (`a72b7ef`) con una interfaz `EnviadorCorreo`: `BrevoEnviador` (API HTTPS, timeout de 10 s) para producción y `GmailSmtpEnviador` para desarrollo, elegidos con `MAIL_PROVIDER`, con validación de configuración al arrancar y pruebas de éxito, 400/401, timeout y red. Luego refactoricé `NotificadorFactory` para que registre canales por el token `NOTIFICADORES` (`ddeb86f`), con pruebas de extensibilidad. El 10/10 había agregado al log el código técnico del error de envío (`27102e5`).

**Decisión**

Cambiar a una API HTTPS porque Render bloquea el SMTP saliente ([ADR-021](../adr/ADR-021-correo-con-proveedor-abstracto.md), que reemplazó al [ADR-019](../adr/ADR-019-gmail-smtp-para-verificacion.md)). La fábrica dejó de conocer clases concretas para que agregar un canal solo requiera una clase y su registro.

**Problema o bloqueo**

El envío de correo fallaba en producción con `ETIMEDOUT`. Para distinguir un bloqueo de red de credenciales inválidas o variables faltantes, primero registré `err.code`, `err.responseCode`, `err.command` y la demora (`27102e5`), sin guardar direcciones ni credenciales. El registro mostró que la conexión SMTP no llegaba al servidor, y la solución fue pasar a la API HTTPS de Brevo, con un timeout que aborta la llamada sin exponer la clave (prueba en `brevo.enviador.spec.ts`).

**Commits**

- `27102e5`, `a72b7ef`, `ddeb86f`

---

### 2026-10-18 · 8 h

**Tarjeta(s) Jira:** no citada en los commits (`73bbf51`, `ad8d386`, `8963659`, `65ecc2d`, `fadb12b`, `34a9ca9`)

**Actividad**

Implementé la vigencia de membresías por fechas (`73bbf51`, adaptada en el cliente por `ad8d386`): una función central de vigencia usada por acceso, reservas, precios, pagos, clientes y reportes. Una compra con membresía vigente queda como próxima y empieza al terminar la anterior, con máximo una vigente y una próxima; `fecha_fin` es exclusiva y las fechas se calculan en hora de Argentina. Convertí el cliente en PWA instalable (`8963659`), con un service worker que precachea solo archivos estáticos y deja la API siempre por red. Resolví el manejo de errores de carga y de falta de conexión (`65ecc2d`) y agregué el canal push con Web Push y claves VAPID (`fadb12b`, `34a9ca9`).

**Decisión**

Decidí la vigencia por fechas y no solo por el campo `estado` ([ADR-022](../adr/ADR-022-vigencia-de-membresias.md)), porque una membresía en estado ACTIVO puede estar vencida por fecha. El service worker no cachea la API para no servir datos de acceso viejos, y el push queda deshabilitado si no hay claves configuradas ([ADR-011](../adr/ADR-011-pwa-en-lugar-de-app-nativa.md)).

**Problema o bloqueo**

Una carga fallida se mostraba como "sin membresía" o "sin datos", y en la reserva de canchas, si fallaba la consulta de ocupación del día, aparecían todos los horarios como libres. Lo resolví con un estado de error con motivo y botón "Reintentar", reintento automático al volver la conexión, un banner global de "Sin conexión a internet" y el bloqueo de la grilla cuando falla la ocupación. A nivel de base, para la superposición de membresías usé bloqueo de fila por usuario y traduje el error de exclusión de Postgres a un 409 (`73bbf51`).

**Commits**

- `73bbf51`, `ad8d386`, `8963659`, `65ecc2d`, `fadb12b`, `34a9ca9`

---

## Sprint 6 — Móvil — Unidad VI — 2026-10-23 al 2026-11-05

La parte móvil de este sprint (PWA instalable y notificaciones push) ya estaba hecha desde el 18/10; la describo en esa entrada. En esta ventana trabajé en las pruebas del acceso y en el pipeline de CI, que son de la Unidad V.

### 2026-10-29 · 1 h

**Tarjeta(s) Jira:** no citada en los commits (`ac9c961`, `a0c3e5b`)

**Actividad**

Escribí las pruebas unitarias del servicio de acceso (`ac9c961`): generación y validación del QR por token y por código corto, la regla RN-01 (un segundo ingreso con sesión abierta responde 409), aforo, alcance por sede y egreso, más el informe `docs/testing/informe-auditoria-testing.md`. Armé el pipeline de GitHub Actions (`a0c3e5b`): instalación, verificación de tipos, pruebas con informe de cobertura y compilación del servidor, y compilación del cliente, en cada push y pull request a `main`.

**Decisión**

Siguiendo la estrategia de pruebas ([ADR-008](../adr/ADR-008-estrategia-de-pruebas.md)), documenté con pruebas dos comportamientos que todavía estaban mal, en lugar de ocultarlos: el error de índice único (23505) que no se traducía a 409 y el token QR reutilizable dentro de su vigencia (mensaje de `ac9c961`).

**Problema o bloqueo**

Esas dos fallas fueron el hallazgo de la entrada. El informe de testing señala además que el servicio de acceso tenía cobertura baja, que ninguna prueba usaba una base real y que antes de `a0c3e5b` no había CI. Máximo aplicó la corrección del token de un solo uso y de la traducción del 23505 a 409 en `009914b` y `c2d8e0e` (09/11).

**Commits**

- `ac9c961`, `a0c3e5b`
- Del equipo, relacionados: `009914b`, `c2d8e0e`

---

## Sprint 7 — Integración — Unidad Cierre — 2026-11-06 al 2026-11-19

### 2026-11-09 (11:26) · 1,5 h

**Tarjeta(s) Jira:** `5885c68` y `1eec536` citan `[FT1-nn]` sin número. La bitácora de Máximo relaciona `1eec536` con FT1-95 a FT1-104.

**Actividad**

Implementé el ingreso manual por DNI para recepción con previsualización y auditoría (`5885c68`): `POST /acceso/buscar-dni` y `POST /acceso/validar-dni`, el modo DNI en `ControlAcceso.tsx` y `acceso-dni.spec.ts`. Después adapté la estructura del repositorio a los lineamientos de entrega (`server/` a `backend/` y `client/` a `frontend/`, `1eec536`).

**Decisión**

El ingreso por DNI pasa por la misma lógica que el QR y el código corto (`registrarIngresoValidado`: sede, vigencia, aforo y RN-01) y queda auditado como `INGRESO_MANUAL_DNI`. La previsualización devuelve solo nombre, apellido, foto y estado de la membresía y no registra nada. Un DNI inexistente y el de alguien que no es socio dan el mismo 404, para que la búsqueda no revele datos. Limité los endpoints a 20 y 30 peticiones por minuto y los reservé a Recepcionista y gerentes.

**Problema o bloqueo**

Mi versión chocó con el endurecimiento que Máximo hizo el mismo día. Conservamos la mía y él volvió a aplicar su corrección sobre mi código. Ahí vimos que el 23505 se traducía a 409 solo en el ingreso por DNI, y que con QR y con código corto seguía saliendo 500.

**Commits**

- `5885c68`, `1eec536`

---

### 2026-11-09 (17:05 y 18:18) · 2 h

**Tarjeta(s) Jira:** FT1-64 (asignada a Máximo) y FT1-87 (`3abeccf`). `cd24628` cita `[FT1-nn]` sin número.

**Actividad**

Endurecí el acceso y el CI (`3abeccf`): `JwtStrategy` rechaza los tokens de tipo `qr-acceso` como sesión (con pruebas nuevas en `jwt.strategy.spec.ts`), el código corto se genera con `randomInt` de `crypto` y pasé Node a 22 en `ci.yml` y en los Dockerfiles ([ADR-009](../adr/ADR-009-despliegue-contenerizacion-y-reversion.md)). Antes, `cd24628` había subido Node a 22 en el CI por un requisito de supabase-js.

**Decisión**

Un QR firmado no puede valer como cookie de sesión: valido el tipo del token en la estrategia ([ADR-014](../adr/ADR-014-autenticacion-y-autorizacion.md)). El código corto pasa a generarse con un generador criptográfico.

**Problema o bloqueo**

El token del QR (vigente 60 s) se firma con el mismo secreto que la sesión, por lo que `JwtStrategy` lo aceptaba como sesión. El código corto se generaba con `Math.random`, que no es criptográfico. El CI también se había roto porque supabase-js exige WebSocket nativo, que Node 20 no trae.

**Commits**

- `3abeccf`, `cd24628`

---

### 2026-11-09 (19:46) · 2 h

**Tarjeta(s) Jira:** FT1-105, FT1-106 y FT1-107 (`9b9529e`)

**Actividad**

Implementé la base del acceso sin conexión en el backend (`9b9529e`): el servicio `claves-qr.service.ts`, que firma el QR con ES256 (clave P-256 por configuración y `kid` en el encabezado), la migración `012-acceso-offline.sql` con su reversión, la entidad `evento-acceso-offline`, las columnas nuevas de `control-acceso` y los endpoints de clave pública y de snapshot. Escribí `acceso-offline.spec.ts`.

**Decisión**

Firma asimétrica del QR (ES256) en lugar de HS256 para que el terminal verifique con solo la clave pública y no pueda fabricar QR. Sin clave configurada se sigue firmando con HS256 y el modo offline queda no disponible. La migración es aditiva (columnas con valor por defecto y una tabla) para que el código anterior siga funcionando con ella aplicada ([ADR-003](../adr/ADR-003-estrategia-offline-del-acceso.md) y [ADR-007](../adr/ADR-007-sincronizacion-del-terminal-de-sede.md)).

**Problema o bloqueo**

Al firmar, `@nestjs/jwt` prefiere el `secret` del módulo (HS256) sobre `privateKey`; para no tocar el `JwtModule`, la firma ES256 pasa el `secret` en cada llamada. Además, en las variables de entorno el PEM suele llegar en una sola línea con `\n` literales, y `claves-qr.service.ts` lo normaliza.

**Commits**

- `9b9529e`

---

### 2026-11-09 (19:58) · 0,5 h

**Tarjeta(s) Jira:** FT1-108 (`59218ce`)

**Actividad**

Implementé `POST /acceso/sincronizar` (`59218ce`): procesamiento de cada evento en su propia transacción, resultados `CREADO`, `OBSERVADO`, `CONFLICTO` y `RECHAZADO`, y traducción de las violaciones de índice único con `restriccionViolada`. Escribí pruebas unitarias (`acceso-sincronizacion.spec.ts`) y de integración contra PostgreSQL (`acceso-sincronizacion.int-spec.ts`).

**Decisión**

Una transacción por evento y, primero se registra el evento y después el ingreso, para que los índices únicos detecten el QR reusado (`jti`) y la sesión abierta. La idempotencia usa el identificador de evento del cliente: un evento ya procesado devuelve lo guardado.

**Problema o bloqueo**

Un 23505 aborta la transacción en curso, así que el resultado del evento se registra en una transacción nueva y corta. Si en el medio otro proceso tomó el `jti`, el evento se guarda sin él; y si ganó el mismo identificador, devuelvo lo de ese. Los rechazos y conflictos no reservan el `jti`, para que otro evento válido del mismo QR no quede bloqueado por un envío mal formado.

**Commits**

- `59218ce`

---

### 2026-11-09 (20:07 a 20:29) · 2 h

**Tarjeta(s) Jira:** FT1-109 (los tres commits) y FT1-69 (`458a14c`)

**Actividad**

Hice el frontend del acceso sin conexión en tres commits. En `458a14c`: la verificación ES256 del QR en el navegador (`verificarQr.ts`), el almacén IndexedDB (`almacenOffline.ts`) y la configuración de Vitest. En `b3b10d5`: el arranque conserva la sesión ante un fallo de red o un servidor caído, con una copia local solo de los campos del usuario, sin tokens. En `281446f`: la descarga del snapshot, la cola de ingresos con sincronización por lotes y el hook `useModoOffline`.

**Decisión**

La sesión sigue siendo la cookie httpOnly del backend ([ADR-014](../adr/ADR-014-autenticacion-y-autorizacion.md)), y el estado de conexión y de sesión del cliente vive en `AuthContext` ([ADR-006](../adr/ADR-006-framework-frontend-componentes-estado.md)). La copia local no guarda credenciales ni tokens y vence a las 24 horas, para que el terminal pueda abrir sin red sin debilitar la sesión real. Un 401 o 403 sigue cerrando la sesión.

**Problema o bloqueo**

El arranque de `AuthContext.tsx` cerraba la sesión ante cualquier fallo al consultar al servidor, así que un terminal sin red no podía abrir la app. Separé la falta de respuesta (red, timeout, 5xx) de una respuesta de sesión inválida (`decidirTrasFalloAlArrancar`) e hice que el interceptor de Axios nunca cierre la sesión por un error de red. Con la sesión sin verificar, reintento al volver la conexión y cada 30 s.

**Commits**

- `458a14c`, `b3b10d5`, `281446f`

---

### 2026-11-09 (20:35) · 0,5 h

**Tarjeta(s) Jira:** FT1-110 (`000cdc7`)

**Actividad**

Integré el modo sin conexión en la pantalla de control de acceso (`000cdc7`): `ControlAcceso.tsx` descarga el snapshot al abrir y lo renueva si tiene más de una hora, valida el QR localmente sin conexión, muestra el aviso con "Sincronizar ahora" y el resumen de la última sincronización. Dejé las decisiones y los textos en funciones puras (`decisionesPantalla.ts`), con 30 pruebas.

**Decisión**

Paso a validación local solo ante falta de respuesta, timeout o error 5xx; un 4xx del servidor se muestra como rechazo real. El ingreso por código, por DNI y el egreso quedan deshabilitados sin conexión, con un texto que lo explica, porque necesitan al servidor.

**Problema o bloqueo**

Antes de este commit la pantalla bloqueaba toda validación sin conexión y mostraba "Sin conexión a internet". Sin otros bloqueos registrados en esta entrada.

**Commits**

- `000cdc7`

---

### 2026-11-10 · 6 h

**Tarjeta(s) Jira:** relaciono por el título de las tarjetas, porque los commits no las citan: FT1-111 (documentación del modo offline), FT1-125 (CI con pruebas del frontend), FT1-127 (README) y FT1-112 (planificación).

**Actividad**

Documenté lo que implementé el día anterior. Pasé el [ADR-003](../adr/ADR-003-estrategia-offline-del-acceso.md) y el [ADR-007](../adr/ADR-007-sincronizacion-del-terminal-de-sede.md) a Aceptado y los ajusté al diseño real (`2483dfd`). Actualicé el manual técnico (`7360627`), el manual de instalación con Node 22, la clave del QR y la migración 012 (`6d0284a`) y el manual de usuario con el modo sin conexión (`6e88ca9`, `b3c4419`), y dejé en cada diagrama el autor real en el encabezado (`2ada7c3`). Marqué la auditoría de estado como informe histórico (`5093e1a`), completé el README con integrantes y la declaración de uso de IA (`e3cd8f6`), agregué el plan de proyecto (`6ac98a5`) y la transcripción de los anexos (`2baecb7`) e hice que el CI corra las pruebas del frontend (`018ec89`). La primera versión de esta bitácora es `33fc5a7` (09/11, 23:20).

**Decisión**

Documentar de forma explícita los límites del modo sin conexión en el [ADR-003](../adr/ADR-003-estrategia-offline-del-acceso.md) y el [ADR-007](../adr/ADR-007-sincronizacion-del-terminal-de-sede.md), en lugar de presentarlo como solución total: la ventana de revocación de hasta 24 horas, el ingreso por código y por DNI que requieren conexión, y el reintento tras timeout que puede terminar en conflicto.

**Problema o bloqueo**

Varios documentos contradecían al código: la auditoría de estado decía que el acceso offline no existía, y el manual de instalación seguía en Node 20. Además descubrí que el CI no corría las pruebas del frontend (solo se ejecutaban en mi máquina), por eso agregué el paso en `018ec89`.

**Commits**

- `2483dfd`, `7360627`, `6d0284a`, `6e88ca9`, `5093e1a`, `6ac98a5`, `2baecb7`, `e3cd8f6`, `018ec89`, `2ada7c3`, `b3c4419`, `33fc5a7`

---

### 2026-11-11 · 4 h

**Tarjeta(s) Jira:** relaciono por título: FT1-130 (prueba de punta a punta del modo offline en producción), FT1-91, FT1-112 y FT1-117. Los commits no las citan.

**Actividad**

Probé el modo sin conexión en producción con un celular como recepcionista y la PC como socio, y encontré dos fallas que corregí. Generé también el Dossier (`bb4542e`) y actualicé la planificación a formato APA con la evidencia de requisitos no funcionales (`a7e8533`). Las correcciones: `d3a2e4b` y `fa28dfa` (snapshot y visor), `099f93a` (detención del lector QR).

**Decisión**

Agregué un `ErrorBoundary` y un aviso global de errores en el cliente para que una pantalla rota muestre el texto del error y no quede en blanco: en un teléfono no tengo consola, y sin ese texto no podía diagnosticar. Protegí el cierre del lector de QR con una función propia (`detenerLector`) que consulta el estado antes de llamar a `stop()`.

**Problema o bloqueo**

Primero, el lector aceptaba el QR pero informaba que no había datos del socio. Consulté la base de producción y los socios existían con membresía vigente, así que el problema estaba en el endpoint: la consulta del snapshot no seleccionaba la columna `estado`, y la función de vigencia exige estado ACTIVO, de modo que todos los socios quedaban descartados. Lo corregí agregando `estado` al `select`. Las pruebas unitarias no lo detectaron porque usaban datos completos; solo la prueba real en producción lo mostró. Segundo, al volver la conexión la pantalla quedaba en negro. El `ErrorBoundary` mostró `Cannot stop, scanner is not running or paused`: `stop()` de html5-qrcode lanza el error de forma síncrona cuando el lector no está escaneando, así que el `.catch` no lo atrapaba y rompía el render cuando el componente se desmontaba tras haber frenado la cámara. Escribí `LectorQr.test.tsx` con tres casos y verifiqué en el teléfono el ciclo completo: sin conexión, lectura, reconexión y sincronización.

**Commits**

- `bb4542e`, `a7e8533`, `d3a2e4b`, `fa28dfa`, `099f93a`

---

## Entre sprints

### 2026-08-28 y 2026-08-29 · 2,5 h

**Tarjeta(s) Jira:** `1802fc4` no cita tarjeta; se relaciona con FT1-22 (asignada a Máximo, que redactó el [ADR-017](../adr/ADR-017-auditoria-en-dos-capas.md); la implementación del interceptor y del trigger es mía). `6e26252` y `b9418b1` no citan tarjeta. Estas fechas caen entre el Sprint 1 (termina el 27/08) y el Sprint 2 (empieza el 03/09).

**Actividad**

El 28/08 agregué la tabla `precios_plan`, editable por el gerente, y pasé el cálculo de montos de pago al servidor (`6e26252`), y sumé la gestión de instructores (`b9418b1`). El 29/08 implementé el sistema de auditoría (`1802fc4`): un interceptor global `@Auditable` y un trigger de Postgres sobre la tabla de pagos, que registra acciones sensibles en las 9 entidades principales. En el mismo commit corregí `GET /clases/:id/reservas`, evité membresías duplicadas tras un pago rechazado (`PATCH /membresias/:id/cancelar`), agregué la renovación (`POST /membresias/renovar`) y el indicador `simularRechazo` en la pasarela simulada, para que QA pueda probar el rechazo.

**Decisión**

El servidor calcula el monto a partir del plan o del precio final de la reserva e ignora el que manda el cliente ([ADR-016](../adr/ADR-016-montos-calculados-en-servidor.md)). La auditoría tiene dos capas: el interceptor aporta el contexto de la aplicación y el trigger cubre los cambios directos sobre pagos ([ADR-017](../adr/ADR-017-auditoria-en-dos-capas.md)).

**Problema o bloqueo**

El mensaje de `1802fc4` registra seis fallas que corregí en ese commit: `GET /clases/:id/reservas` fallaba por falta de `relations`; reintentar tras un pago rechazado creaba membresías duplicadas; un duplicado de reserva de clase dejaba pasar el error crudo de Postgres; el dashboard del socio no distinguía un error de red de "sin membresía activa"; y la pantalla de completar membresía avanzaba como éxito con el pago rechazado. Además, el detalle de la auditoría guardaba tokens, y agregué la redacción automática de secretos (`008-redactar-secretos-auditoria.sql`, `26dfa17`).

**Commits**

- `6e26252`, `b9418b1`, `1802fc4`

---

## Sprint 8 — Demo Day — Unidad Cierre — 2026-11-23 al 2026-11-29

_Sprint todavía no iniciado. Agregaré la entrada cuando termine la semana._
