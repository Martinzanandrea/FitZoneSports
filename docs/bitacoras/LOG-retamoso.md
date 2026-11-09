# Bitácora — Retamoso, Máximo — Rol COMPLETAR (P1 a P4)

Bitácora individual según la plantilla del Anexo C. Las entradas de los sprints 2, 3 y 5 vienen de `docs/LOG.md` (bitácora grupal original). Los campos marcados **COMPLETAR** van a mano.

Usuario de Git: `maxi` (maxiretamosotrotta@gmail.com).

## Sprint 1 — Unidad I — Semana del 2026-08-10

### AAAA-MM-DD · COMPLETAR h

**Actividad**

COMPLETAR

**Decisión**

COMPLETAR

**Problema o bloqueo**

COMPLETAR

**Commits**

COMPLETAR (no hay commits con el usuario `maxi` en este sprint)

---

## Sprint 2 — Unidad I / II — Semana del 2026-08-24

### 2026-08-24 · COMPLETAR h

**Actividad**

Debate grupal sobre Monolito Modular vs Microservicios (FT1-9): sostuve transacciones ACID fuertes para RN-02 (anti-sobreventa de canchas) como criterio decisivo, con equipo de 4 y time-to-market como criterios secundarios.

**Decisión**

Monolito Modular con NestJS, documentado en ADR-0002 (FT1-16).

**Problema o bloqueo**

posiciones iniciales divididas en el equipo; se cerró con matriz de criterios (ACID, equipo, deploy) acordada entre los tres.

**Commits**

`e22cde0`

---

### 2026-09-02 · COMPLETAR h

**Actividad**

Redacción de ADR-0001 GitHub como repositorio compartido (FT1-15) y de ADR-0002 Monolito Modular (FT1-16): ramas por integrante y versionado acoplado como costo aceptado.

**Decisión**

monorepo único cliente+servidor con formato Nygard de 5 campos.

**Problema o bloqueo**

numeración de ADRs con gaps tras varias iteraciones; se resolvió con renumeración basada en git log.

**Commits**

`612d9ce`, `068e8b6`, `e22cde0`

---

## Sprint 3 — Unidad II / III — Semana del 2026-09-07

### 2026-09-10 · COMPLETAR h

**Actividad**

M2 Gimnasio y Acceso (FT1-37, RF-04/RF-05/RN-01): QR dinámico de 60s + código corto de 6 dígitos de un solo uso, doble chequeo de membresía activa al generar y validar, aforo con conteo de sesiones abiertas y sesión única por usuario.

**Decisión**

JWT firmado de corta vida + revalidación en servidor en vez de QR estático.

**Problema o bloqueo**

la ventana de 60s entre generar y validar obligó al doble chequeo de membresía; aforo resuelto con índice parcial sobre sesiones abiertas.

**Commits**

`7862d54`, `f4bbfdc`, `23cf2ff`

---

### 2026-09-12 · COMPLETAR h

**Actividad**

M5 Pagos (FT1-40, RF-13/RF-14) y módulos de soporte (FT1-42: sedes, franjas, precios, instructores): pasarela mock con token, membresía creada solo con pago APROBADO en la misma transacción, promoción EXTERNO→SOCIO, comprobante PDF 1:1 por pago; catálogo de tipos de cancha y ABM de sedes con franjas.

**Decisión**

montos siempre calculados en servidor y clases incluidas en membresía (RN-03).

**Problema o bloqueo**

el doble cobro concurrente se resolvió con lock pesimista + verificación de pago existente (409 al segundo intento).

**Commits**

`7862d54`, `26dfa17`, `f07fa62`, `13b0d95`

---

### 2026-09-14 · COMPLETAR h

**Actividad**

Redacción de ADR-0008 sistema de auditoría en dos capas (FT1-22): interceptor con @Auditable para contexto de app + trigger en Postgres sobre pagos para cubrir cambios directos, con redacción automática de secretos.

**Decisión**

dos capas complementarias (interceptor + trigger).

**Problema o bloqueo**

el detalle JSON guardaba tokens; se agregó redacción automática de secretos + migración.

**Commits**

`1802fc4`, `068e8b6`

---

### 2026-09-18 · COMPLETAR h

**Actividad**

Justificación escrita de los tres patrones GoF aplicados (FT1-26): Strategy en pricing dinámico (RF-11), Observer en lista de espera (RF-08) y Repository con lock pesimista anti-sobreventa (RN-02), con refactor a forma canónica (Strategy con array inyectado por token PRICING_STRATEGIES, Repository con interfaz + implementación in-memory para tests).

**Decisión**

documentar por qué cada patrón y qué alternativa se descartó.

**Problema o bloqueo**

la primera versión no era polimórfica real; se refactorizó a forma canónica y se verificó sin regresiones.

**Commits**

`cdca2b6`, `5552f69`, `2c6c8d7`

---

## Sprint 4 — Unidad III — Semana del 2026-09-21

### AAAA-MM-DD · COMPLETAR h

**Actividad**

COMPLETAR

**Decisión**

COMPLETAR

**Problema o bloqueo**

COMPLETAR

**Commits**

COMPLETAR (no hay commits con el usuario `maxi` en este sprint)

---

## Sprint 5 — Unidad IV / V — Semana del 2026-10-05

### 2026-10-05 · COMPLETAR h

**Actividad**

Pantallas públicas del home/inicio y catálogos (FT1-48, Listo): landing multi-página (/, /clases, /canchas, /sedes, /nosotros) con nav compartido. Fix propio del nav que no volvía arriba al cambiar de ruta (componente ScrollToTop global).

**Decisión**

layout público único (PublicLayout) en vez de repetir nav en cada página; fix global en vez de parchar página por página.

**Problema o bloqueo**

react-router conserva el scroll entre rutas y no había ningún manejo de scroll en el frontend; se diagnosticó reproduciendo scroll + clic contra recarga.

**Commits**

`9f46ceb`, `b3ec7c3` (mergeado a main, en producción)

---

### 2026-10-06 · COMPLETAR h

**Actividad**

Reorganización con Atomic Design (FT1-32): átomos (10 piezas, un archivo por componente), moléculas (12), organismos (layouts) con barrels index.ts + README del sistema; formatMoney a shared/utils; eliminado código muerto (ui.tsx partido, Donut duplicado, Reveal/Layout sin uso). Rama refactor/atomic-design, build limpio.

**Decisión**

un archivo por componente + barrels por nivel en vez de cajón único; mover sin cambiar comportamiento.

**Problema o bloqueo**

el build marcó dos errores tras el move (rutas relativas e import de barrel); se corrigieron y el build quedó limpio.

**Commits**

`772b856` (mergeado a main con PR #1)

---

### 2026-10-11 · COMPLETAR h

**Actividad**

Cierre de FT1-50 rol Gerente de Sede (FT1-53 pantallas; endpoints FT1-51 de MZ y BD FT1-52 de TA, ya en main): login con cuenta de prueba, panel propio y las 10 pantallas del rol (personal, canchas, clases, reservas, reportes, pagos, membresías, instructores, acceso) cargando datos de su sede, sin 403 ni blancos.

**Decisión**

cerrar como Listo con verificación funcional por rol en vez de solo inspección de código.

**Problema o bloqueo**

sin bloqueantes: se verificó además el scope por sede (el GS solo ve datos de su sede en personal, reservas y reportes).

**Commits**

`f07fa62`, `13b0d95`

---

### 2026-10-13 · COMPLETAR h

**Actividad**

Pruebas manuales en producción (FT1-30/54/55: 20 ejecutadas, 2 parciales) con cuentas de prueba por rol, y reporte en docs/PRUEBAS.md con tablas por grupo, plantilla y hallazgos (FT1-56). Incluye registro con mail real verificado, compra en cuenta fresca, doble clic en cuenta propia sin duplicado y baja de clase TEST con aviso. Limpieza verificada en base: sin sesiones ni reservas abiertas.

**Decisión**

probar contra producción (como pide el plan) con cuentas de prueba, cancelando/cerrando todo lo creado en el acto; no ejecutar mail masivo por riesgo a socios reales.

**Problema o bloqueo**

sin clase casi llena no hay última plaza real (se probó carrera en paralelo sin duplicados); throttle de login confirmado al 6.º intento.

**Commits**

`5371015` (reporte docs/PRUEBAS.md, mergeado a main con el PR #2)

---

## Sprint 6 — Unidad V — Semana del 2026-10-19

### AAAA-MM-DD · COMPLETAR h

**Actividad**

COMPLETAR

**Decisión**

COMPLETAR

**Problema o bloqueo**

COMPLETAR

**Commits**

COMPLETAR (no hay commits con el usuario `maxi` en este sprint)

---

## Sprint 7 — Unidad VI / Cierre — Semana del 2026-11-02

### 2026-11-09 · COMPLETAR h

**Actividad**

Cierre de los requisitos de admisibilidad de la entrega: QR de un solo uso y conflicto 23505 traducido a 409; migraciones reproducibles con su reversión y script de migración; datos de prueba de 25 sedes; docker compose con almacenamiento local; pruebas de integración contra Postgres para RN-01 y RN-02 con umbral de cobertura en el CI; swagger.json exportado; escaneo de secretos; los diez ADR obligatorios; diagramas C4, DER, despliegue y pipeline; corrección de la carga de clases (429 con 25 sedes); integración con la reestructura backend/frontend; los tres manuales.

**Decisión**

COMPLETAR

**Problema o bloqueo**

COMPLETAR

**Commits**

- `009914b` fix(acceso): QR de un solo uso y conflicto 23505 como 409 en todos los ingresos
- `b101898` feat(db): migraciones reproducibles desde cero, con reversión y registro
- `5f5f7b6` feat(db): datos de prueba con 25 sedes, canchas, clases y usuarios de todos los roles
- `a63719c` feat(storage): almacenamiento de archivos intercambiable, con proveedor local
- `6b33468` build: levantar el sistema completo con docker compose up --build
- `c2d8e0e` test: integración contra Postgres real para RN-01 y RN-02, y umbral de cobertura
- `ab9b759` docs(api): exportar el contrato OpenAPI a swagger.json
- `532fb99` ci: escaneo de secretos con gitleaks sobre todo el historial
- `849e354` docs(adr): los diez ADR obligatorios en la plantilla del Anexo B
- `74894a6` docs(diagramas): C4, DER físico, despliegue y pipeline con fuente editable
- `6713502` fix(clases): cargar las ocurrencias de todas las clases en un solo pedido
- `458225c` docs(manuales): capturas del sistema por rol
- `7a7b3a3` merge con la reestructura backend/ y frontend/
- `86452ab` fix(cliente): plazos de cancelación iguales a los que aplica el servidor
- `a5b6a03` docs(manuales): manual de usuario, de instalación y operación, y técnico

---

## Sprint 8 — Unidad Cierre — Semana del 2026-11-16

### AAAA-MM-DD · COMPLETAR h

**Actividad**

COMPLETAR

**Decisión**

COMPLETAR

**Problema o bloqueo**

COMPLETAR

**Commits**

COMPLETAR

---
