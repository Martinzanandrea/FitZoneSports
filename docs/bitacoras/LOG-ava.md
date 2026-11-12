# Bitácora — Ava, Teo — Rol: Frontend

Usuario de Git: `Teo` (teoava3@gmail.com).

## Sprint 1 — Arquitectura — Unidad I — 2026-08-13 al 2026-08-27

### 2026-09-04 · 3 hs

**Tarjeta(s) Jira:** FT1-10 (Niveles C4 y ADR fundacionales)

**Actividad**

Hice los tres diagramas C4 del sistema en draw.io y los exporté a PNG:

- **Contexto:** los actores del sistema y los sistemas externos con los que se relaciona.
- **Contenedores:** la aplicación web (Vercel), la API (Render) y PostgreSQL con el almacenamiento de archivos (Supabase).
- **Componentes:** los módulos de la API en NestJS.

Martín colaboró dándoles los toques finales y fue quien los integró al repositorio. También revisé los ADR iniciales del equipo.

**Decisión**

Elegí C4 en lugar de UML clásico. Con C4 el sistema se explica en cuatro niveles de zoom, que va del negocio al código, y cualquier lector puede entender cada nivel sin conocer el detalle del siguiente. Cada nivel quedó en su propio archivo (`DiagramaComponentesc4.drawio`, `Diagramacontenedoresc4.drawio` y `ModeloContextoc4.drawio`), de modo que se puede editar uno sin tocar los otros.

**Problema o bloqueo**

Los ADR iniciales quedaron con la numeración desordenada: había saltos y no seguían el orden cronológico, porque se fueron agregando, quitando y reescribiendo en varias iteraciones. La numeración se ordenó después con una renumeración basada en el historial de git (ver la entrada de Martín en `docs/LOG.md`). Mi parte fue la revisión; la renumeración la hizo el equipo y no es un commit mío.

**Commits**

Sin commits propios: Martín integró mi trabajo.

**Evidencia del equipo**

- `612d9ce` Documentacion y correcciones (martin): agrega `docs/C4/` con los tres `.drawio` y los PNG de contexto y contenedores.
- `068e8b6` Documentacion y correccion de adrs (martin): ADR 0001 a 0008 en la plantilla del equipo.
- `7a06627` docs: rediseño de clases recurrentes + auditoría y consolidación de ADRs (martin, 2026-09-09)

---

## Sprint 2 — Frameworks — Unidad II — 2026-09-03 al 2026-09-17

### 2026-09-04 · 1 hs

**Tarjeta(s) Jira:** FT1-21 (ADR - Cálculo de montos server-side)

**Actividad**

Cambié la reserva de canchas por parte de los usuarios, en frontend y backend (`25718bf`):

- En el servidor agregué un endpoint `POST cotizar` en `reservas-cancha.controller.ts`, que devuelve el precio de una reserva antes de confirmarla. Para que reservar y cotizar usen la misma regla, saqué el cálculo a un método privado `calcularPrecio` en `reserva-cancha.service.ts`: aplica el descuento de socio activo y la hora pico.
- En el cliente actualicé `ReservarCanchas.tsx` (`canchas.api.ts` suma la llamada a cotizar) y ajusté `ReservarClases.tsx`.

**Decisión**

Hice que el servidor rechace la reserva (y también la cotización) de un horario que ya comenzó, con el mensaje "No se puede reservar un horario que ya comenzó". La validación está en el servidor y no solo en la pantalla, porque el servidor es quien tiene que garantizar la regla aunque el cliente mande cualquier fecha.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

- `25718bf` Cambios en las reservas de canchas por parte de los Usuarios

---

### 2026-09-06 al 2026-09-07 · 5 hs

**Tarjeta(s) Jira:** FT1-70 (Primera versión del cobro en efectivo en mostrador), FT1-38 (M3 Clases Grupales) y FT1-71 (Corrección del límite de intentos de login)

**Actividad**

*FT1-70, cobro en efectivo (`782b39a`).* Rehice la pantalla de cobro en efectivo del mostrador (`CobrarEfectivo.tsx` y `pagos.api.ts`). En el backend agregué el endpoint `GET pagos/efectivo/opciones` y el método `obtenerOpcionesCobro` del servicio de pagos. Ese método reúne en una sola respuesta los usuarios (socios y externos), las membresías, las reservas de clase reservadas y las reservas de cancha confirmadas, para que quien cobra elija lo que corresponde en lugar de cargarlo a mano.

*FT1-38, clases grupales (`e9e8d65` y `c564a90`).* Cambié las reglas de reserva de clases en `reserva-clase.service.ts` y la pantalla `GestionReservasClases.tsx`. Pasé el cálculo del tiempo previo de horas a minutos para poder expresar límites distintos según quién reserva. También cambié cómo se define el horario al crear una clase en `ClasesPage.tsx` (74 líneas nuevas).

*FT1-71, límite de intentos de login (`9abc4b1`).* Corregí el endpoint de login para que el límite de 5 intentos por minuto por IP se aplicara de verdad. Martín había dejado marcado el defecto a las 00:46 (commit `14ed42d`).

**Decisión**

- En el cobro en efectivo, restringí el endpoint de opciones a recepcionista y gerente (`@Roles`) y lo filtré por sede: cada persona que cobra recibe solo los usuarios, membresías y reservas de su sede. Así una recepción no ve ni cobra lo de otra sede.
- En clases, dejé el límite de reserva en minutos para poder aplicar una regla para el propio socio y otra para el staff que anota a otra persona.

**Problema o bloqueo**

- *Cobro en efectivo incompleto.* La parte de membresías del cobro en efectivo quedó sin terminar en este commit; el mensaje de `782b39a` lo dice: "Falta modificar la parte de Membresia".
- *El límite de login no se aplicaba.* El endpoint aceptaba intentos ilimitados aunque tenía configurado el límite de 5 por minuto. Martín sospechó que podía ser por la versión de TypeScript o de NestJS. Revisé el controlador y encontré que el endpoint tenía además un `@SkipThrottle()`, que anulaba el `@Throttle` de 5 intentos. Lo quité, junto con el comentario que marcaba el error, y el límite quedó activo. Lo comprobé haciendo seis intentos de login seguidos, y el sexto fue rechazado con 429.

**Commits**

- `782b39a` Cobrar en efectivo cambiado (Falta modificar la parte de Membresia)
- `e9e8d65` Cambios en la reservas de clases
- `c564a90` Cambios realizados al crear Clases(horario)
- `9abc4b1` error throttle solucionando

**Evidencia del equipo**

- `14ed42d` remarco error en throtle, no funciona el limite de intento de login fallidos (martin, 2026-09-07 00:46): el defecto que corregí.

---

### 2026-09-06 al 2026-09-08 · 2 hs

**Tarjeta(s) Jira:** FT1-19 (ADR - Autenticación JWT y autorización por rol/dueño/sede) y FT1-21 (ADR - Cálculo de montos server-side)

**Actividad**

Revisé los dos ADR. No los implementé ni los subí yo: Martín los integró al repositorio.

- *ADR sobre autenticación (FT1-19).* Establece que el JWT viaja en una cookie httpOnly, que hay dos puertas de login (`/login` para clientes y `/admin/login` para personal) y que el recepcionista queda limitado a su sede mediante `assertSedeScope`.
- *ADR sobre montos (FT1-21).* Establece que el monto de un pago se calcula siempre en el servidor, a partir de una tabla de precios que solo edita el gerente, e ignora cualquier importe que mande el cliente.

**Decisión**

Sostuve la decisión del ADR de montos: que el servidor sea la única fuente del importe. Si el monto lo declarara el cliente, cualquiera podría modificar la petición y pagar menos. La alternativa descartada es confiar en el monto que envía el frontend. Es la misma regla que aplico en el commit `25718bf`, donde el precio de la reserva de cancha lo calcula el servidor.

**Problema o bloqueo**

Después de la revisión, el ADR de autenticación necesitó correcciones de redacción. La versión corregida la subió Martín el 08/09.

**Commits**

Sin commits propios.

**Evidencia del equipo**

- `068e8b6` Documentacion y correccion de adrs (martin, 2026-09-06): agrega los ADR 0005 (autenticación y autorización) y 0007 (integridad de montos server-side).
- `d10d478` Adr5 corregido (martin, 2026-09-08): versión corregida del ADR de autenticación.

---

### 2026-09-07 · 1 hs

**Tarjeta(s) Jira:** FT1-14 (Documentación de la API con Swagger)

**Actividad**

Documenté la API con Swagger. Recorrí los controladores de todos los módulos (acceso, administración, auditoría, autenticación, canchas, clases, instructores, membresías, pagos, precios, sedes y usuarios) y a cada uno le agregué:

- `@ApiTags`, para que los endpoints aparezcan agrupados por módulo.
- `@ApiOperation`, con un resumen en español de lo que hace cada endpoint.
- `@ApiCookieAuth('token')` en los endpoints protegidos, porque el sistema autentica con una cookie y no con un token Bearer.

En los DTO agregué `@ApiProperty` y `@ApiPropertyOptional` con una descripción y un valor de ejemplo por campo (por ejemplo en `login.dto.ts`, `create-sede.dto.ts` y `create-pago.dto.ts`), de manera que quien lea Swagger entienda qué manda cada endpoint sin abrir el código. El commit modifica unos 40 archivos.

Para comprobarlo abrí `/api` en el navegador y probé endpoints desde la propia interfaz de Swagger.

**Decisión**

Elegí Swagger en lugar de una colección de Postman suelta, porque la documentación vive junto al código y se actualiza cuando se cambia el controlador o el DTO. Una colección aparte se desactualiza apenas alguien cambia un endpoint y no avisa. Decidí agruparlo por módulo, con un resumen por endpoint, para que la documentación se pueda recorrer igual que el sistema. También documenté de forma explícita la autenticación por cookie, y no solo los parámetros, porque es lo primero que alguien tiene que saber para probar un endpoint protegido. Y documenté los DTO para que el contrato de entrada se entienda desde Swagger.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

- `48c3add` Documentacion Swagger

---

## Sprint 3 — Patrones — Unidad III — 2026-09-15 al 2026-09-24

_Sin sesión propia acreditada en este sprint. Mi entrada del 2026-09-23 (`df91a7a`) cae también en la ventana del Sprint 3, pero corresponde a la Unidad IV y la ubico en el Sprint 4._

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-08-24 · 2 hs

**Tarjeta(s) Jira:** FT1-28 (Estado global y comunicación entre componentes)

**Actividad**

Participé en la discusión de cómo manejar el estado global del frontend: la sesión del usuario, compartida entre las pantallas sin pasarla de componente en componente. La mayor parte del trabajo la hizo Martín: él implementó `AuthContext` (con el hook `useAuth`) y el guardia de rutas por rol y sede `ProtectedRoute`. Mi parte fue la discusión y la revisión del enfoque; no escribí el código de esta tarjeta.

**Decisión**

Participé en la discusión; la decisión y la implementación fueron de Martín.

**Problema o bloqueo**

Sin bloqueos propios. El problema de la sesión entre pestañas y del vencimiento de la sesión lo resolvió Martín en `6e4ed9a`.

**Commits**

Sin commits propios.

**Evidencia del equipo**

- `71c2f71` Estructuracion del frontend (martin, 2026-08-24): estructura del frontend, estado global de autenticación y capa de servicio.
- `6e4ed9a` fix(auth): sincronizar la sesión entre pestañas y manejar bien el vencimiento (martin, 2026-10-08)

---

### 2026-08-26 al 2026-08-29 · 4 hs

**Tarjeta(s) Jira:** FT1-76 (Panel de administración: sedes, usuarios y reportes)

**Actividad**

Armé las secciones de sedes y de usuarios del panel de administración del gerente.

- *Sedes* (`SedesPage.tsx`, `sedes.api.ts`): listado de sedes y un formulario para crear una sede nueva o editar una existente. Cada sede se puede activar o desactivar desde la lista.
- *Personal* (`CrearStaff.tsx`, `usuarios.api.ts`): modifiqué la pantalla de alta de personal. En el servidor agregué `POST /usuarios/staff` para crear personal y `PATCH /usuarios/:id/rol` para asignar un rol, con su DTO `assign-role.dto.ts` y el método `assignRole` en el servicio de usuarios.
- *Rutas y acceso:* agregué la ruta `/admin/sedes` en `AppRoutes.tsx` y ajusté los tipos de los roles en `Login.tsx`.
- *Reportes* (`2e4c417`): agregué el acceso a Reportes en el menú del gerente, en `AdminLayout.tsx`.

Para comprobarlo entré con la cuenta del gerente y probé estas pantallas.

**Decisión**

Protegí las operaciones de personal y de roles para que solo las pueda usar el gerente. En el servidor lo hice con `JwtAuthGuard`, `RolesGuard` y `@Roles(GERENTE)`; en el cliente, con `ProtectedRoute` en la ruta `/admin/sedes`. No dejé el control solo en la pantalla: ocultar un botón no impide llamar al endpoint, y por eso la regla tiene que estar en el servidor. La protección del cliente evita que otros roles vean la pantalla, pero la que realmente protege es la del servidor.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

- `64817da` Seccion de sedes y usuarios en el panel de administracion
- `2e4c417` Reportes en AdminLayout

---

### 2026-08-28 · 5 hs

**Tarjeta(s) Jira:** FT1-77 (Gestión de reservas de clases y canchas para el gerente)

**Actividad**

Armé las pantallas del gerente para gestionar reservas, clases y canchas (`7b33ea7`, 20 archivos, 768 líneas agregadas).

- *Cliente:* `ReservasPage.tsx`, `ClasesPage.tsx`, `CanchasPage.tsx`, `PersonalPage.tsx` y `GerenteDashboard.tsx`, con sus capas de servicio (`admin.api.ts`, `canchas.api.ts`, `clases.api.ts`, `instructores.api.ts`), además de las rutas en `AppRoutes.tsx` y el menú en `AdminLayout.tsx`.
- *Servidor:* un módulo `admin` nuevo (`admin.controller.ts`, `admin.service.ts` y `admin.module.ts`) que devuelve los datos ya consolidados para el panel.
- *Documentación:* escribí el ADR 0012, "Endpoints agregados para el panel gerencial" (numeración de ese momento).

**Decisión**

Plasmé en el ADR 0012 que el panel del gerente use endpoints agregados, como `GET /admin/dashboard/resumen` y `GET /admin/reservas`, que devuelven en una sola respuesta lo que cada pantalla necesita. La alternativa era que el frontend consultara cada módulo por separado, lo que aumentaba la cantidad de pedidos HTTP y repartía la lógica de consolidación entre varios componentes. Con la decisión tomada, los cálculos quedan en el backend y el frontend solo muestra y filtra. El costo que acepté está en el propio ADR: los endpoints dependen de varias entidades y cualquier cambio en la respuesta obliga a coordinar backend y frontend. Los endpoints quedan protegidos con `JwtAuthGuard`, `RolesGuard` y el rol `GERENTE`.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

- `7b33ea7` Reservas y Gestión de Clases/Canchas para Gerente

---

### 2026-09-23 · 2 hs

**Tarjeta(s) Jira:** FT1-77 (Gestión de reservas de clases y canchas para el gerente)

**Actividad**

Arreglé la pantalla de gestión de reservas de clases (`df91a7a`, en `GestionReservasClases.tsx` y `CalendarioSede.tsx`). Agregué un selector de sede para el gerente: la sede elegida queda en la URL (`?sedeId=`), y el botón del calendario de la sede abre esta pantalla ya con esa sede. Las clases que se pueden anotar ahora se muestran agrupadas por día, con el nombre del día de la semana. También pedí las ocurrencias de las clases con paginación de hasta 100 por página.

**Decisión**

Agrupé las clases anotables por día para que la lista se lea más rápido: la pantalla muestra primero el día y debajo las clases de ese día.

**Problema o bloqueo**

La pantalla de reservas de clases tomaba la sede del usuario (`user.sedeId`). El gerente no tiene una sede asignada, así que la lista le aparecía vacía y no podía gestionar reservas. Lo resolví con el selector de sede: si el usuario es gerente, elige la sede en el desplegable, y si es recepcionista se mantiene su sede.

**Commits**

- `df91a7a` Arreglo en Gestionar Reservas de Clases

---

### 2026-09-23 · 1 hs

**Tarjeta(s) Jira:** FT1-47 (Pantallas del socio/cliente)

**Actividad**

Probé las pantallas de reservas de clases y de canchas del socio. Las pantallas las implementó Martín, dentro de su rediseño del área de Socio; no escribí ese código. Lo único mío en esas dos pantallas es el cambio del 04/09 que ya cuento en la entrada de FT1-21 (`25718bf`: cotización del precio y rechazo de horarios pasados).

**Decisión**

Sin decisión propia.

**Problema o bloqueo**

Sin hallazgos.

**Commits**

Sin commits propios. 

**Evidencia del equipo**

- `9f46ceb` feat(landing): landing pública multi-página + rediseño completo del área de Socio (martin, 2026-09-23)
- `98f7645` feat: sesión entre pestañas, reservas seguras, personal y clientes, cobro del recepcionista y desplegables (martin, 2026-10-09)

---

### 2026-10-07 · 1 hs

**Tarjeta(s) Jira:** FT1-52 (Subtarea: Modificar BD), de FT1-50 (rol Gerente de Sede)

**Actividad**

Me ocupé de la modificación de la base de datos para el rol Gerente de Sede. Se nos había recomendado sumar un tercer rol de administración, el gerente de una sola sede, además del gerente general y del recepcionista. Para eso:

- Ejecuté el `ALTER TYPE` en Supabase para agregar el nuevo valor al tipo enumerado de actor (`tipo_actor`).
- Actualicé también los enums del código, para que coincidieran con los de la base.

Esos cambios llegaron al repositorio en un commit de Martín (`f07fa62`), junto con el script `005-gerente-sede.sql` y el resto del rol; por eso no figuran como commit mío.

**Decisión**

Sin decisión propia.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

Sin commits propios.

**Evidencia del equipo**

- `f07fa62` feat: jerarquía de roles, rediseño liquid glass y flujo Externo a Socio (martin, 2026-10-07): agrega `server/db/sql/005-gerente-sede.sql` y los valores `GERENTE_GENERAL` y `GERENTE_SEDE` en `enums.ts` del servidor y del cliente.

---

## Sprint 5 — Testing y CI/CD — Unidad V — 2026-10-09 al 2026-10-22

### 2026-10-18 · 3 hs

**Tarjeta(s) Jira:** FT1-54 (Pruebas de uso)

**Actividad**

Probé flujos del sistema con cuentas de prueba y participé en el reporte de QA del sprint 5, `docs/PRUEBAS.md`. Ese reporte lo publicó Máximo (`5371015`) y en su encabezado figura él como quien ejecutó las pruebas en producción; mi parte fueron las pruebas de uso que hice con las cuentas de prueba y mi participación en ese reporte.

**Decisión**

Sin decisión propia.

**Problema o bloqueo**

Sin hallazgos.

**Commits**

Sin commits propios.

**Evidencia del equipo**

- `5371015` docs: QA Sprint 5 — reporte de pruebas manuales en produccion (FT1-30) (maxi)
- `d825d21` Pruebas (martin, 2026-10-18): actualización de `docs/PRUEBAS.md`.

---

### 2026-10-20 · 2 hs

**Tarjeta(s) Jira:** FT1-58 (Pruebas unitarias del acceso por QR y RN01) y FT1-65 (Informe de auditoría del testing y cobertura)

**Actividad**

*FT1-58.* Ejecuté las pruebas unitarias del acceso por QR y de RN-01 siguiendo las indicaciones que me dio Martín, y después le comuniqué los resultados. Las pruebas las escribió Martín; yo no escribí código en esta tarjeta.

*FT1-65.* El informe de auditoría del testing y de la cobertura (`docs/testing/informe-auditoria-testing.md`, con fecha 29/10) fue un trabajo de los tres integrantes. Yo le pasé observaciones a Martín. Martín fue quien lo subió al repositorio, y por eso todo figura en un commit suyo.

**Decisión**

Sin decisión propia.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

Sin commits propios.

**Evidencia del equipo**

- `ac9c961` test(acceso): pruebas unitarias del servicio de acceso por QR y RN01 (martin, 2026-10-29): incluye las pruebas de FT1-58 y el informe `docs/testing/informe-auditoria-testing.md` de FT1-65.

---

## Sprint 6 — Móvil — Unidad VI — 2026-10-23 al 2026-11-05

_Sin sesión propia acreditada en la Unidad VI (móvil). La PWA y las notificaciones push las implementó Martín el 2026-10-18 (`8963659`, `fadb12b`, `34a9ca9`, `65ecc2d`).

## Sprint 7 — Integración — Unidad Cierre — 2026-11-06 al 2026-11-19

### 2026-11-09 · 1 hs

**Tarjeta(s) Jira:** Ninguna.

**Actividad**

Agregué al repositorio el SQL de la estructura completa de la base de datos, sin los datos, esquema `public`, con fecha 9/11/2026 (`9f1e2e2`): un volcado de 1226 líneas en `fitzone-estructura-20261109.sql`, en la raíz del repositorio.

**Decisión**

Sin decisión propia.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

- `9f1e2e2` docs(db): agregar SQL de la estructura de la base (esquema public, 9/11/2026)

---

### 2026-11-12 · 1 hs

**Tarjeta(s) Jira:** FT1-124 (Actualizar dependencias vulnerables del frontend, npm audit)

**Actividad**

Actualicé las dependencias vulnerables del frontend. `npm audit` informaba 4 vulnerabilidades de severidad alta, en `vite` y en `launch-editor`. Corrí `npm audit fix` en `frontend/`, que cambió solo `package-lock.json`, y verifiqué el resultado:

- Las vulnerabilidades altas bajaron a 0, y las de producción (`npm audit --omit=dev`) a 0.
- `npm run build` termina bien.
- Las pruebas del frontend pasan: 10 archivos y 170 pruebas.

**Decisión**

No usé `npm audit fix --force`. Quedan 15 vulnerabilidades de severidad baja o moderada, todas en herramientas de desarrollo (`deepmerge`, `glob`, `minimatch`, a través de `eslint`). Corregirlas con `--force` exige subir versiones mayores y puede romper cosas, y no afectan lo que se despliega, así que las dejé documentadas.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

- `68aec71` fix(frontend): actualizar dependencias vulnerables con npm audit fix [FT1-124]

---

### 2026-11-12 · 2 hs

**Tarjeta(s) Jira:** FT1-131 (Estructura del frontend frente al punto 4: verificar y documentar)

**Actividad**

Armé un borrador de la comparación entre la estructura del frontend y la que proponen los lineamientos de entrega (punto 4) y se lo pasé a Martín. Él lo completó y lo subió al repositorio como `docs/entregables/estructura-frontend.md`, por eso todo figura en un commit suyo.

**Decisión**

Sin decisión propia.

**Problema o bloqueo**

Sin bloqueos.

**Commits**

Sin commits propios.

**Evidencia del equipo**

- `31da61d` docs(frontend): documentar la correspondencia con la estructura del punto 4, corregir el README de shared/components y enlazarlo desde el README raíz [FT1-131] (martin, 2026-11-12).
