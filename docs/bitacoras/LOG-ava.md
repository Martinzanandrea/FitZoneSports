# Bitácora — Ava, Teo — Rol: Frontend

Bitácora individual con el mismo formato que `docs/bitacoras/LOG-zanandrea.md` y `docs/bitacoras/LOG-retamoso.md` (plantilla del Anexo C). Los hashes, fechas y mensajes provienen de `git log --author` real: son los commits de autoría de Teo Ava. Los sprints y sus fechas son los de `LOG-retamoso.md`.

**Las horas son estimaciones calculadas a partir de los timestamps de los commits.** Regla: por cada fecha, se ordenan los commits (sin merges) por hora local; se suman los intervalos entre commits consecutivos de 90 minutos o menos; se suman 30 minutos por cada commit como tiempo previo de trabajo; se redondea a media hora, con mínimo 0,5 h. La entrada de la madrugada del 6 al 7 de septiembre agrupa cuatro commits consecutivos que cruzan la medianoche.

**Tarjetas.** Ningún commit de Teo cita una tarjeta. Cuando una entrada indica una tarjeta "por coincidencia de título", la asociación sale de comparar el mensaje del commit con el título de la tarjeta en `docs/planificacion/PLANIFICACION.md`, y está **por confirmar** contra el tablero. `docs/LOG.md` asocia a Teo con otras tarjetas (por ejemplo FT1-10, FT1-19, FT1-21, FT1-28 y FT1-38) citando commits cuya autoría en git es de Martín; esas entradas no se repiten acá.

Usuario de Git: `Teo` (teoava3@gmail.com). Sus commits tocan el frontend y también archivos del backend (en ese momento las carpetas se llamaban `client/` y `server/`).

## Sprint 1 — Arquitectura — Unidad I — 2026-08-13 al 2026-08-27

### 2026-08-26 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. Por coincidencia de título: FT1-76 (Panel de administración: sedes, usuarios y reportes), por confirmar

**Actividad**

Sección de sedes y usuarios en el panel de administración (`64817da`): páginas `SedesPage.tsx` y `CrearStaff.tsx` con sus capas de servicio (`sedes.api.ts`, `usuarios.api.ts`), ajuste de `Login.tsx` y de `AppRoutes.tsx`, y en el backend un DTO `assign-role.dto.ts` y el método `assignRole` del servicio de usuarios para asignar un rol.

**Decisión**

Sin decisión registrada en el mensaje del commit ni en su diff.

**Problema o bloqueo**

Sin bloqueos registrados en el historial.

**Commits**

- `64817da`

---

## Sprint 2 — Frameworks — Unidad II — 2026-09-03 al 2026-09-17

### 2026-09-04 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit

**Actividad**

Cambios en las reservas de cancha por parte de los usuarios (`25718bf`): `ReservarCanchas.tsx` y `ReservarClases.tsx` en el frontend, y `reserva-cancha.service.ts` y `reservas-cancha.controller.ts` en el backend.

**Decisión**

El servicio de reserva de cancha rechaza la reserva de un horario que ya comenzó (diff de `reserva-cancha.service.ts`). El mensaje del commit no registra por qué.

**Problema o bloqueo**

Sin bloqueos registrados en el historial. El diff muestra que se agregaron las validaciones "No se puede reservar un horario que ya comenzó" y la comprobación de existencia de la cancha y del usuario.

**Commits**

- `25718bf`

---

### 2026-09-06 al 2026-09-07 (madrugada) · 3,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en los commits. Por coincidencia de título, por confirmar: `782b39a` con FT1-70 (Primera versión del cobro en efectivo en mostrador); `e9e8d65` y `c564a90` con FT1-38 (M3 Clases Grupales); `9abc4b1` con FT1-71 (Corrección del límite de intentos de login)

**Actividad**

Sesión continua de cuatro commits, de las 23:53 a las 01:12:

- `782b39a` (23:53): cobro en efectivo en `CobrarEfectivo.tsx`, `pagos.api.ts`, `pagos.controller.ts` y `pagos.service.ts`.
- `e9e8d65` (00:01): cambios en las reservas de clases (`GestionReservasClases.tsx` y `reserva-clase.service.ts`).
- `c564a90` (00:12): cambios al crear clases con horario en `ClasesPage.tsx`.
- `9abc4b1` (01:12): corrección del límite de intentos de login en `auth.controller.ts`.

**Decisión**

Sin decisión registrada en los mensajes ni en los diffs.

**Problema o bloqueo**

El mensaje de `782b39a` deja constancia de que quedó pendiente: "Falta modificar la parte de Membresia" del cobro en efectivo. `9abc4b1` ("error throttle solucionando") quita del endpoint de login el `@SkipThrottle()` y el comentario con el que `14ed42d` (commit de otro integrante del 2026-09-07) había marcado que el límite de intentos del login no se aplicaba. Cómo se verificó la corrección no consta en el commit.

**Commits**

- `782b39a`, `e9e8d65`, `c564a90`, `9abc4b1`

---

### 2026-09-07 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. `docs/LOG.md` lo asocia con FT1-14 (Documentación de la API con Swagger), que coincide con el título del tablero

**Actividad**

Documentación de la API con Swagger (`48c3add`): decoradores y descripciones en los controladores de acceso, administración, auditoría, autenticación, canchas y clases, y en sus DTO (`validar-qr.dto.ts`, `registrar-egreso.dto.ts`, `login.dto.ts`, `create-cancha.dto.ts`, entre otros).

**Decisión**

Según `docs/LOG.md`, Swagger en lugar de una colección de Postman suelta, porque vive con el código y no se desactualiza. El mensaje del commit no lo registra.

**Problema o bloqueo**

Sin bloqueos registrados en el historial.

**Commits**

- `48c3add`

---

## Sprint 3 — Patrones — Unidad III — 2026-09-15 al 2026-09-24

_Sin actividad propia registrada para este sprint. Los commits de Teo del 2026-09-23 se asignan al sprint 4, que también está en curso en esa fecha._

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-09-23 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. Por coincidencia de título: FT1-77 (Gestión de reservas de clases y canchas para el gerente), por confirmar

**Actividad**

Arreglo en la gestión de reservas de clases (`df91a7a`): cambios en `GestionReservasClases.tsx` y en `CalendarioSede.tsx` (88 líneas agregadas y 25 quitadas).

**Decisión**

Sin decisión registrada en el mensaje del commit ni en su diff.

**Problema o bloqueo**

El mensaje habla de un "arreglo" en la pantalla, sin describir el defecto. Sin más detalle registrado en el historial.

**Commits**

- `df91a7a`

---

## Sprint 5 — Testing y CI/CD — Unidad V — 2026-10-29 al 2026-11-12

_Sin actividad propia registrada para este sprint._

## Sprint 6 — Móvil — Unidad VI — 2026-10-22 al 2026-11-05

_Sin actividad propia registrada para este sprint._

## Sprint 7 — Integración — Unidad Cierre — 2026-11-05 al 2026-11-19

### 2026-11-09 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. Sprint: no hay una tarjeta asociada; se usa el sprint 7 por la fecha

**Actividad**

Se agrega al repositorio el SQL de la estructura de la base de datos, esquema `public`, con fecha 9/11/2026 (`9f1e2e2`): un volcado de 1226 líneas en `fitzone-estructura-20261109.sql`, en la raíz del repositorio.

**Decisión**

Sin decisión registrada en el mensaje del commit. El archivo está en la raíz del repositorio y no en `docs/`.

**Problema o bloqueo**

Sin bloqueos registrados en el historial.

**Commits**

- `9f1e2e2`

---

## Trabajo previo o entre sprints

Las fechas siguientes caen fuera de las ventanas de sprint documentadas en `docs/bitacoras/LOG-retamoso.md`.

### 2026-08-28 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. Por coincidencia de título: FT1-77 (Gestión de reservas de clases y canchas para el gerente), por confirmar. Fecha entre el sprint 1 (termina el 2026-08-27) y el sprint 2 (empieza el 2026-09-03)

**Actividad**

Reservas y gestión de clases y canchas para el gerente (`7b33ea7`): páginas `ReservasPage.tsx`, `ClasesPage.tsx`, `CanchasPage.tsx` y `GerenteDashboard.tsx` del panel de administración, sus capas de servicio (`admin.api.ts`, `canchas.api.ts`, `clases.api.ts`, `instructores.api.ts`, `usuarios.api.ts`), `PersonalPage.tsx`, `AdminLayout.tsx` y `AppRoutes.tsx` (20 archivos, 768 líneas agregadas).

**Decisión**

Sin decisión registrada en el mensaje del commit ni en su diff.

**Problema o bloqueo**

Sin bloqueos registrados en el historial.

**Commits**

- `7b33ea7`

---

### 2026-08-29 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. Por coincidencia de título: FT1-76 (Panel de administración: sedes, usuarios y reportes), por confirmar. Fecha entre el sprint 1 y el sprint 2

**Actividad**

Agrega el acceso a Reportes en el menú del panel de administración (`2e4c417`: una línea en `AdminLayout.tsx`).

**Decisión**

Sin decisión registrada en el mensaje del commit ni en su diff.

**Problema o bloqueo**

Sin bloqueos registrados en el historial.

**Commits**

- `2e4c417`

---

### 2026-10-14 · 0,5 h (estimación)

**Tarjeta(s) Jira:** Sin tarjeta citada en el commit. Fecha entre el sprint 4 (termina el 2026-10-08) y el sprint 6 (empieza el 2026-10-22)

**Actividad**

Completa las entradas de Teo en la bitácora grupal `docs/LOG.md` para las unidades I, II y IV (`f12acdb`: 39 líneas agregadas y 3 quitadas). Esas entradas citan commits cuya autoría en git es de otro integrante, razón por la cual esta bitácora individual se rehízo sobre los commits propios.

**Decisión**

Sin decisión registrada en el mensaje del commit.

**Problema o bloqueo**

Sin bloqueos registrados en el historial. Las unidades III, V y VI de `docs/LOG.md` quedaron como pendientes para Teo en ese archivo.

**Commits**

- `f12acdb`

---

## Sprint 8 — Demo Day — Unidad Cierre — 2026-11-19 al 2026-12-03

_Sprint todavía no iniciado._

---
