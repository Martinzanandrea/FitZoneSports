# Bitácora — Retamoso, Máximo — Rol P4

Bitácora individual según la plantilla del Anexo C. Los sprints, sus fechas y las tarjetas (FT1-nn) son los del tablero Jira del equipo. Las entradas de los sprints 1 a 5 vienen de `docs/LOG.md` (bitácora grupal original). En cada entrada, los commits se separan en propios (usuario de Git `maxi`) y del equipo (autor indicado entre paréntesis).

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

- Propios: ninguno
- Del equipo, relacionados con la tarea: `e22cde0` (martin, 24/08, ADR del monolito modular)

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

- Propios: ninguno
- Del equipo, relacionados con la tarea: `612d9ce`, `068e8b6` (martin, 04/09 y 06/09); `e22cde0` (martin, 24/08)

---

### 2026-09-10 · 4 h

**Tarjeta(s) Jira:** FT1-37 (4 pts)

**Actividad**

M2 Gimnasio y Acceso (FT1-37, RF-04/RF-05/RN-01): QR dinámico de 60s + código corto de 6 dígitos de un solo uso, doble chequeo de membresía activa al generar y validar, aforo con conteo de sesiones abiertas y sesión única por usuario.

**Decisión**

JWT firmado de corta vida + revalidación en servidor en vez de QR estático.

**Problema o bloqueo**

la ventana de 60s entre generar y validar obligó al doble chequeo de membresía; aforo resuelto con índice parcial sobre sesiones abiertas.

**Commits**

- Propios: ninguno
- Del equipo, relacionados con la tarea: `7862d54` (martin, 15/08), `23cf2ff` (martin, 16/09), `f4bbfdc` (martin, 30/09)

---

### 2026-09-12 · 5 h

**Tarjeta(s) Jira:** FT1-40 (6 pts) y FT1-42 (5 pts)

**Actividad**

M5 Pagos (FT1-40, RF-13/RF-14) y módulos de soporte (FT1-42: sedes, franjas, precios, instructores): pasarela mock con token, membresía creada solo con pago APROBADO en la misma transacción, promoción EXTERNO→SOCIO, comprobante PDF 1:1 por pago; catálogo de tipos de cancha y ABM de sedes con franjas.

**Decisión**

montos siempre calculados en servidor y clases incluidas en membresía (RN-03).

**Problema o bloqueo**

el doble cobro concurrente se resolvió con lock pesimista + verificación de pago existente (409 al segundo intento).

**Commits**

- Propios: ninguno
- Del equipo, relacionados con la tarea: `7862d54` (martin, 15/08), `13b0d95` (martin, 01/10), `f07fa62` (martin, 07/10), `26dfa17` (martin, 09/10)

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

- Propios: ninguno
- Del equipo, relacionados con la tarea: `1802fc4` (martin, 29/08), `068e8b6` (martin, 06/09)

---

## Sprint 3 — Patrones — Unidad III — 2026-09-15 al 2026-09-24

### 2026-09-18 · 3 h

**Tarjeta(s) Jira:** FT1-26 (4 pts)

**Actividad**

Justificación escrita de los tres patrones GoF aplicados (FT1-26): Strategy en pricing dinámico (RF-11), Observer en lista de espera (RF-08) y Repository con lock pesimista anti-sobreventa (RN-02), con refactor a forma canónica (Strategy con array inyectado por token PRICING_STRATEGIES, Repository con interfaz + implementación in-memory para tests).

**Decisión**

documentar por qué cada patrón y qué alternativa se descartó.

**Problema o bloqueo**

la primera versión no era polimórfica real; se refactorizó a forma canónica y se verificó sin regresiones.

**Commits**

- Propios: ninguno
- Del equipo, relacionados con la tarea: `cdca2b6`, `5552f69` (martin, 20/08), `2c6c8d7` (martin, 15/09)

---

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-10-05 · 2 h

**Tarjeta(s) Jira:** FT1-48

**Actividad**

Pantallas públicas del home/inicio y catálogos (FT1-48, Listo): landing multi-página (/, /clases, /canchas, /sedes, /nosotros) con nav compartido. Fix propio del nav que no volvía arriba al cambiar de ruta (componente ScrollToTop global).

**Decisión**

layout público único (PublicLayout) en vez de repetir nav en cada página; fix global en vez de parchar página por página.

**Problema o bloqueo**

react-router conserva el scroll entre rutas y no había ningún manejo de scroll en el frontend; se diagnosticó reproduciendo scroll + clic contra recarga.

**Commits**

- Propios: `b3ec7c3` (11/10, fix del scroll al cambiar de ruta)
- Del equipo, relacionados con la tarea: `9f46ceb` (martin, 23/09, landing pública)

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

- Propios: `772b856` (11/10, mergeado con el PR #1)

---

### 2026-10-11 · 2 h

**Tarjeta(s) Jira:** FT1-50 (5 pts), subtarea FT1-53

**Actividad**

Cierre de FT1-50 rol Gerente de Sede (FT1-53 pantallas; endpoints FT1-51 de MZ y BD FT1-52 de TA, ya en main): login con cuenta de prueba, panel propio y las 10 pantallas del rol (personal, canchas, clases, reservas, reportes, pagos, membresías, instructores, acceso) cargando datos de su sede, sin 403 ni blancos.

**Decisión**

cerrar como Listo con verificación funcional por rol en vez de solo inspección de código.

**Problema o bloqueo**

sin bloqueantes: se verificó además el scope por sede (el GS solo ve datos de su sede en personal, reservas y reportes).

**Commits**

- Propios: ninguno
- Del equipo, relacionados con la tarea: `13b0d95` (martin, 01/10), `f07fa62` (martin, 07/10)

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

- Propios: `5371015` (13/10, reporte `docs/PRUEBAS.md`, mergeado con el PR #2)

Las pruebas se hicieron el 13/10, antes de la fecha de inicio del sprint en el tablero.

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

- Propios: `009914b` (QR de un solo uso y 23505 como 409), `c2d8e0e` (pruebas de integración, umbral de cobertura y CI)

---

## Sprint 6 — Móvil — Unidad VI — 2026-10-22 al 2026-11-05

### AAAA-MM-DD · COMPLETAR h

**Tarjeta(s) Jira:** el sprint no tiene tarjetas cargadas en el tablero

**Actividad**

COMPLETAR (en el repositorio no hay commits del usuario `maxi` entre el 22/10 y el 05/11; si no hubo actividad propia, dejarlo dicho así)

**Decisión**

COMPLETAR

**Problema o bloqueo**

COMPLETAR

**Commits**

- Propios: ninguno

---

## Sprint 7 — Integración — Unidad Cierre — 2026-11-05 al 2026-11-19

### 2026-11-09 · 4 h

**Tarjeta(s) Jira:** COMPLETAR (tarjetas a crear en el tablero)

**Actividad**

Cierre de los requisitos de admisibilidad de la entrega: migraciones reproducibles desde una base vacía con su reversión y script de migración; datos de prueba con 25 sedes; almacenamiento de archivos intercambiable y `docker compose up --build`; contrato OpenAPI exportado; escaneo de secretos del historial completo; los diez ADR obligatorios en la plantilla del Anexo B; diagramas C4, DER, despliegue y pipeline; corrección de la carga de clases (429 con 25 sedes) y de los plazos de cancelación mostrados; integración con la reestructura backend/frontend; los tres manuales; README.

**Decisión**

Escribir un script de migraciones propio sobre los SQL que ya existían, en lugar de las migraciones de TypeORM, porque el esquema usa restricciones que el ORM no genera (índices únicos parciales, exclusión GiST, triggers). Hacer intercambiable el almacenamiento de archivos para que Docker funcione sin Supabase.

**Problema o bloqueo**

Las migraciones no levantaban una base vacía: 002 repetía lo del 001 y faltaban GERENTE_SEDE y la tabla de push. Con 25 sedes, la pantalla de reservar clases hacía más de 100 pedidos y la API respondía 429. El merge con la reestructura de carpetas de Martín dio conflictos en package.json, main.ts y el exportador de Swagger, que estaba duplicado: me quedé con el suyo.

**Commits**

- Propios: `b101898`, `5f5f7b6`, `a63719c`, `6b33468`, `ab9b759`, `532fb99`, `849e354`, `74894a6`, `6713502`, `458225c`, `7a7b3a3`, `8b605ad`, `86452ab`, `a5b6a03`, `79faad7`, `32a2ca8`
- Del equipo, relacionados con la tarea: `1eec536` (martin, 09/11, reestructura backend/frontend que se integró)

---

## Sprint 8 — Demo Day — Unidad Cierre — 2026-11-19 al 2026-12-03

### AAAA-MM-DD · COMPLETAR h

_Sprint todavía no iniciado._

---
