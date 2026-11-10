# Bitácora — Retamoso, Máximo — Rol P4

Bitácora individual según la plantilla del Anexo C. Los sprints, sus fechas y las tarjetas (FT1-nn) son los del tablero Jira del equipo. Las entradas de los sprints 1 a 5 vienen de `docs/LOG.md` (bitácora grupal original). En cada entrada, los commits se separan en propios y del equipo.

Usuario de Git: `maxi` (maxiretamosotrotta@gmail.com).

## Sprint 1 — Arquitectura — Unidad I — 2026-08-13 al 2026-08-27

### 2026-08-24 · 3 h

**Tarjeta(s) Jira:** FT1-9 (2 pts) y FT1-16 (3 pts), ambas asignadas a MR

**Actividad**

Debate grupal sobre Monolito Modular vs Microservicios (FT1-9): sostuve transacciones ACID fuertes para RN-02 (anti-sobreventa de canchas) como criterio decisivo, con equipo de 4 y time-to-market como criterios secundarios.

**Decisión**

Monolito Modular con NestJS, documentado en ADR-0002 (FT1-16).

**Problema o bloqueo**

posiciones iniciales divididas en el equipo; se cerró con matriz de criterios (ACID, equipo, deploy) acordada entre los tres.

**Commits**

- Del equipo, relacionados con la tarea: `e22cde0`

Trabajo de diseño: el debate y el contenido del ADR-0002 se acordaron con el equipo por mensajes; el ADR lo integró Martín al repositorio.

---

## Sprint 2 — Frameworks — Unidad II — 2026-09-03 al 2026-09-17

### 2026-09-02 · 1 h

**Tarjeta(s) Jira:** FT1-15 (1 pt); FT1-16 es del sprint 1

**Actividad**

Redacción de ADR-0001 GitHub como repositorio compartido (FT1-15) y de ADR-0002 Monolito Modular (FT1-16): ramas por integrante y versionado acoplado como costo aceptado.

**Decisión**

monorepo único cliente+servidor con formato Nygard de 5 campos.

**Problema o bloqueo**

numeración de ADRs con gaps tras varias iteraciones; se resolvió con renumeración basada en git log.

**Commits**

- Del equipo, relacionados con la tarea: `612d9ce`, `068e8b6`, `e22cde0`

---

### 2026-09-10 · 4 h

**Tarjeta(s) Jira:** FT1-37 (4 pts)

**Actividad**

Definición de las reglas del módulo de Gimnasio y Acceso (RF-04, RF-05, RN-01) junto con Martín: QR dinámico que vence a los 60 segundos, código corto de 6 dígitos de un solo uso como alternativa, control de aforo por sede y sesión única por usuario. Martín implementó el módulo; yo lo probé con cuentas de prueba (generación del QR, validación por código y aforo) y le reporté los ajustes necesarios.

**Decisión**

JWT firmado de corta vida con revalidación en el servidor, en vez de un QR estático que se puede fotografiar y compartir.

**Problema o bloqueo**

La ventana de 60 s entre que se genera el QR y se valida obligó a chequear la membresía dos veces, porque puede vencer en el medio. El aforo se resolvió contando las sesiones abiertas, con un índice parcial.

**Commits**

- Del equipo, relacionados con la tarea: `7862d54`, `23cf2ff`, `f4bbfdc`

---

### 2026-09-12 · 5 h

**Tarjeta(s) Jira:** FT1-40 (6 pts) y FT1-42 (5 pts)

**Actividad**

Definición con Martín del funcionamiento de los pagos (RF-13, RF-14) y de los módulos de soporte (sedes, franjas, precios e instructores): pasarela simulada que devuelve un token, membresía creada solo con el pago aprobado, paso de externo a socio y comprobante PDF por pago. Martín los implementó; yo los probé con cuentas de prueba (pago de membresía, pago de cancha, comprobante, alta de sedes y precios).

**Decisión**

Los montos se calculan siempre en el servidor, y las clases vienen incluidas en la membresía (RN-03).

**Problema o bloqueo**

El doble clic al pagar podía cobrar dos veces. Martín lo resolvió con un bloqueo de la fila y verificando si ya había un pago (el segundo intento recibe 409); en las pruebas verifiqué que no se duplica el cobro.

**Commits**

- Del equipo, relacionados con la tarea: `7862d54`, `13b0d95`, `f07fa62`, `26dfa17`

---

### 2026-09-14 · 3 h

**Tarjeta(s) Jira:** FT1-22 (5 pts)

**Actividad**

Redacción de ADR-0008 sistema de auditoría en dos capas (FT1-22): interceptor con @Auditable para contexto de app + trigger en Postgres sobre pagos para cubrir cambios directos, con redacción automática de secretos.

**Decisión**

dos capas complementarias (interceptor + trigger).

**Problema o bloqueo**

el detalle JSON guardaba tokens; se agregó redacción automática de secretos + migración.

**Commits**

- Del equipo, relacionados con la tarea: `1802fc4`, `068e8b6`

---

## Sprint 3 — Patrones — Unidad III — 2026-09-15 al 2026-09-24

### 2026-09-18 · 3 h

**Tarjeta(s) Jira:** FT1-26 (4 pts)

**Actividad**

Definí con Martín cómo armar el documento de justificación de los tres patrones GoF: Strategy en el precio dinámico (RF-11), Observer en la lista de espera (RF-08) y Repository con bloqueo pesimista contra la sobreventa (RN-02). Para cada uno, qué problema resuelve, por qué se eligió frente a las alternativas y qué costo tiene. La redacción la hizo casi toda Martín.

**Decisión**

Documentar para cada patrón el porqué y la alternativa descartada, en lugar de solo describir la implementación.

**Problema o bloqueo**

Al repasar los patrones para justificarlos noté que la primera versión de Strategy no era polimórfica de verdad, porque el calculador conocía las clases concretas. Se lo planteé a Martín, que hizo el refactor a la forma canónica: arreglo de estrategias inyectado por el token PRICING_STRATEGIES y Repository con interfaz e implementación en memoria para las pruebas.

**Commits**

- Del equipo, relacionados con la tarea: `cdca2b6`, `5552f69`, `2c6c8d7`

---

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-10-05 · 2 h

**Tarjeta(s) Jira:** FT1-48

**Actividad**

Definí con Martín el contenido y el diseño de la landing pública multipágina (inicio, clases, canchas, sedes, nosotros, con navegación compartida), que programó él. Al probar la navegación encontré que al cambiar de ruta la página no volvía arriba, y lo arreglé con un componente global ScrollToTop.

**Decisión**

Un layout público único (PublicLayout) en vez de repetir la navegación en cada página, y un arreglo global del scroll en vez de parchear página por página.

**Problema o bloqueo**

React Router conserva el scroll entre rutas y el frontend no tenía ningún manejo de scroll. Lo diagnostiqué comparando el scroll más un clic contra una recarga de la página.

**Commits**

- `b3ec7c3`

- Del equipo, relacionados con la tarea: `9f46ceb`

---

### 2026-10-06 · 4 h

**Tarjeta(s) Jira:** FT1-32 (4 pts)

**Actividad**

Reorganización con Atomic Design (FT1-32): átomos (10 piezas, un archivo por componente), moléculas (12), organismos (layouts) con barrels index.ts + README del sistema; formatMoney a shared/utils; eliminado código muerto (ui.tsx partido, Donut duplicado, Reveal/Layout sin uso). Rama refactor/atomic-design, build limpio.

**Decisión**

un archivo por componente + barrels por nivel en vez de cajón único; mover sin cambiar comportamiento.

**Problema o bloqueo**

el build marcó dos errores tras el move (rutas relativas e import de barrel); se corrigieron y el build quedó limpio.

**Commits**

- `772b856`

---

### 2026-10-11 · 2 h

**Tarjeta(s) Jira:** FT1-50 (5 pts), subtarea FT1-53

**Actividad**

Discutí con Martín las pantallas del nuevo rol Gerente de Sede, que programó él. Las verifiqué con una cuenta de prueba: login, panel propio y las 10 pantallas del rol (personal, canchas, clases, reservas, reportes, pagos, membresías, instructores y acceso), cargando los datos de su sede.

**Decisión**

Cerrar la tarea como Listo después de una verificación funcional por rol, y no solo revisando el código.

**Problema o bloqueo**

En la verificación encontré algunas cosas para corregir y se las pasé a Martín. También revisé el alcance por sede: el gerente de sede solo ve datos de su sede en personal, reservas y reportes.

**Commits**

- Del equipo, relacionados con la tarea: `13b0d95`, `f07fa62`

La tarjeta está en el sprint 4 aunque la verificación se cerró el 11/10, después de la fecha de fin del sprint.

---

## Sprint 5 — Testing y CI/CD — Unidad V — 2026-10-29 al 2026-11-12

### 2026-10-13 · 4 h

**Tarjeta(s) Jira:** FT1-30 (6 pts), FT1-61, FT1-62 y FT1-56

**Actividad**

Pruebas manuales en producción (FT1-30/54/55: 20 ejecutadas, 2 parciales) con cuentas de prueba por rol, y reporte en docs/PRUEBAS.md con tablas por grupo, plantilla y hallazgos (FT1-56). Incluye registro con mail real verificado, compra en cuenta fresca, doble clic en cuenta propia sin duplicado y baja de clase TEST con aviso. Limpieza verificada en base: sin sesiones ni reservas abiertas.

**Decisión**

probar contra producción (como pide el plan) con cuentas de prueba, cancelando/cerrando todo lo creado en el acto; no ejecutar mail masivo por riesgo a socios reales.

**Problema o bloqueo**

sin clase casi llena no hay última plaza real (se probó carrera en paralelo sin duplicados); throttle de login confirmado al 6.º intento.

**Commits**

- `5371015`

---

### 2026-11-09 · 2 h

**Tarjeta(s) Jira:** FT1-59 y FT1-64

**Actividad**

Pruebas de integración contra PostgreSQL real para RN-01 y RN-02 (FT1-59): diez reservas simultáneas de la misma cancha confirman exactamente una, dos ingresos simultáneos del mismo socio en sedes distintas registran uno solo, y el cupo de una clase no se excede bajo concurrencia; umbral de cobertura en `package.json` y jobs de integración y Docker en el CI. Endurecimiento del QR (FT1-64): token de un solo uso con `jti` y la violación del índice de RN-01 (23505) devuelta como 409 en lugar de 500 en los tres tipos de ingreso.

**Decisión**

Probar la concurrencia contra PostgreSQL real y no solo con repositorios en memoria, porque los dobles no reproducen el SELECT … FOR UPDATE ni los índices únicos parciales. Para el QR de un solo uso, guardar los jti usados en memoria hasta que vencen (viven 60 segundos) en vez de una tabla, y traducir el error 23505 en la función común de registro del ingreso, así cubre QR, código y DNI.

**Problema o bloqueo**

Ese mismo día Martín subió el ingreso por DNI y chocaba con mi versión: me quedé con la suya y volví a aplicar solo el endurecimiento sobre su código. Ahí apareció que su versión traducía el 23505 únicamente para el DNI, y con QR y con código seguía saliendo 500. Además, el script de las pruebas de integración borra la base, así que le agregué un resguardo: exige INTEGRACION_DB=true y se niega a correr contra Supabase.

**Commits**

- `009914b`, `c2d8e0e`

---

## Sprint 6 — Móvil — Unidad VI — 2026-10-22 al 2026-11-05

_Sin actividad propia registrada para este sprint._

## Sprint 7 — Integración — Unidad Cierre — 2026-11-05 al 2026-11-19

### 2026-11-09 · 4 h

**Tarjeta(s) Jira:** FT1-95 a FT1-104 (y FT1-86, escaneo de secretos, que está en el sprint 5)

**Actividad**

Cierre de los requisitos de admisibilidad de la entrega: migraciones reproducibles desde una base vacía con su reversión y script de migración; datos de prueba con 25 sedes; almacenamiento de archivos intercambiable y `docker compose up --build`; contrato OpenAPI exportado; escaneo de secretos del historial completo; los diez ADR obligatorios en la plantilla del Anexo B; diagramas C4, DER, despliegue y pipeline; corrección de la carga de clases (429 con 25 sedes) y de los plazos de cancelación mostrados; integración con la reestructura backend/frontend; los tres manuales; README.

**Decisión**

Escribir un script de migraciones propio sobre los SQL que ya existían, en lugar de las migraciones de TypeORM, porque el esquema usa restricciones que el ORM no genera (índices únicos parciales, exclusión GiST, triggers). Hacer intercambiable el almacenamiento de archivos para que Docker funcione sin Supabase.

**Problema o bloqueo**

Las migraciones no levantaban una base vacía: 002 repetía lo del 001 y faltaban GERENTE_SEDE y la tabla de push. Con 25 sedes, la pantalla de reservar clases hacía más de 100 pedidos y la API respondía 429.

**Commits**

- `b101898`, `5f5f7b6`, `a63719c`, `6b33468`, `ab9b759`, `532fb99`, `849e354`, `74894a6`, `6713502`, `458225c`, `7a7b3a3`, `8b605ad`, `86452ab`, `a5b6a03`, `79faad7`, `32a2ca8`
- Del equipo, relacionados con la tarea: `1eec536`

**Revisión de bitácora (FT1-115, 09/11/2026).** Se verificaron los 38 hashes citados contra el historial de `main`. El sprint corresponde a la tarjeta de Jira y la fecha de cada entrada corresponde a la actividad registrada. Las revisiones anteriores de la bitácora quedaron en `72f4f57` y `7766707`.

---

## Sprint 8 — Demo Day — Unidad Cierre — 2026-11-19 al 2026-12-03

_Sprint todavía no iniciado._

---
