# Bitácora individual del equipo — FitZone Sports

Cada integrante documenta sus actividades, decisiones y problemas encontrados por unidad,
vinculado por registro a los commits del repositorio. Los hashes y fechas provienen de
`git log` real; donde no se encontró un commit que calce, se indica explícitamente.

## UNIDAD I — ARQUITECTURA

### Martín Zanandrea

**Fecha:** 2026-08-24
**Actividad:** Decisión de arquitectura Monolito Modular vs Microservicios, motivado por necesidad de transacciones ACID fuertes para RN-02 (anti-sobreventa de canchas).
**Decisión:** Monolito Modular con NestJS, documentado en ADR 0002.
**Problema encontrado:** ninguno relevante en esta etapa.
**Commit(s):** `e22cde0`

### Martín Zanandrea

**Fecha:** 2026-09-09
**Actividad:** Modelado C4 (Contexto, Contenedores, Componentes) en draw.io, y consolidación de 16 ADR iniciales, luego reducidos a 8 tras una revisión crítica de calidad (eliminando ADRs de bajo valor o prematuros, como el de despliegue Railway→Render).
**Decisión:** usar formato Nygard de 5 campos para todos los ADR.
**Problema encontrado:** numeración de ADR con gaps y fuera de orden cronológico tras varias iteraciones; se resolvió con una renumeración completa basada en git log --follow --diff-filter=A.
**Commit(s):** `7a06627`, `612d9ce`

### Teo Ava

**Fecha:** 2026-09-04 a 2026-09-09
**Actividad:** Modelado C4 en 3 niveles (FT1-10): Contexto (actores y sistemas externos), Contenedores (web Vercel, API Render, Postgres + Storage en Supabase) y Componentes (módulos Nest), con diagramas en draw.io exportados a PNG.
**Decisión:** C4 en vez de UML clásico: 4 zooms legibles por cualquier lector, del negocio al código.
**Problema encontrado:** primera versión mezclaba niveles (componentes dentro del diagrama de contexto); se separó en un archivo por nivel.
**Commit(s):** `612d9ce`, `7a06627`

### Máximo Retamoso

**Fecha:** 2026-08-24
**Actividad:** Debate grupal sobre Monolito Modular vs Microservicios (FT1-9): sostuve transacciones ACID fuertes para RN-02 (anti-sobreventa de canchas) como criterio decisivo, con equipo de 4 y time-to-market como criterios secundarios.
**Decisión:** Monolito Modular con NestJS, documentado en ADR-0002 (FT1-16).
**Problema encontrado:** posiciones iniciales divididas en el equipo; se cerró con matriz de criterios (ACID, equipo, deploy) acordada entre los tres.
**Commit(s):** `e22cde0`

## UNIDAD II — FRAMEWORKS

### Martín Zanandrea

**Fecha:** 2026-08-21
**Actividad:** Backend completo con NestJS + TypeORM sobre PostgreSQL (Supabase): 13 módulos (sedes, usuarios, membresías, clases, canchas, pagos, acceso, auth, admin, precios, instructores, auditoría, storage), con Swagger documentado.
**Decisión:** (no aplica — implementación según stack del ADR 0003)
**Problema encontrado:** rate limiting configurado demasiado estricto (20 req/min global) generaba 429 en uso normal de desarrollo; se ajustó a 200/min global manteniendo 5/min específico en login.
**Commit(s):** `7862d54`, `1c30c96`, `48c3add`, `14ed42d`, `9abc4b1`

### Teo Ava

**Fecha:** 2026-09-06 a 2026-09-08
**Actividad:** Redacción de ADR-0005 autenticación JWT con autorización por rol/dueño/sede (FT1-19) y ADR-0007 cálculo de montos server-side (FT1-21): cookie httpOnly, guards + scope fail-closed, y montos siempre recalculados en servidor ignorando el body.
**Decisión:** documentar ambas decisiones con alternativas descartadas (Bearer en localStorage, montos del front).
**Problema encontrado:** correcciones de redacción en ADR-0005 tras revisión.
**Commit(s):** `068e8b6`, `d10d478`

### Teo Ava

**Fecha:** 2026-09-07
**Actividad:** Documentación de la API con Swagger (FT1-14): disponible en /api solo en desarrollo, con auth por cookie documentada.
**Decisión:** Swagger en vez de colección Postman suelta: vive con el código y no se desactualiza.
**Problema encontrado:** ninguno relevante.
**Commit(s):** `48c3add`

### Teo Ava

**Fecha:** 2026-10-09
**Actividad:** M3 Clases Grupales (FT1-38, RF-06/RF-07): plantillas recurrentes semanales, generación automática de ocurrencias (ventana de 4 semanas por cron) y reservas con ventanas 48h/30min/2h.
**Decisión:** plantilla + ocurrencias generadas en vez de eventos sueltos (así opera un gimnasio real).
**Problema encontrado:** endpoint del dashboard referenciaba una columna del modelo viejo y devolvía 500; detectado y corregido tras el refactor.
**Commit(s):** `26dfa17`, `98f7645`

### Máximo Retamoso

**Fecha:** 2026-09-02
**Actividad:** Redacción de ADR-0001 GitHub como repositorio compartido (FT1-15) y de ADR-0002 Monolito Modular (FT1-16): ramas por integrante y versionado acoplado como costo aceptado.
**Decisión:** monorepo único cliente+servidor con formato Nygard de 5 campos.
**Problema encontrado:** numeración de ADRs con gaps tras varias iteraciones; se resolvió con renumeración basada en git log.
**Commit(s):** `612d9ce`, `068e8b6`, `e22cde0`

### Máximo Retamoso

**Fecha:** 2026-09-10
**Actividad:** Definición de las reglas del módulo de Gimnasio y Acceso (RF-04, RF-05, RN-01) junto con Martín: QR dinámico que vence a los 60 segundos, código corto de 6 dígitos de un solo uso como alternativa, control de aforo por sede y sesión única por usuario. Martín implementó el módulo; yo lo probé con cuentas de prueba (generación del QR, validación por código y aforo) y le reporté los ajustes necesarios.
**Decisión:** JWT firmado de corta vida con revalidación en el servidor, en vez de un QR estático que se puede fotografiar y compartir.
**Problema encontrado:** La ventana de 60 s entre que se genera el QR y se valida obligó a chequear la membresía dos veces, porque puede vencer en el medio. El aforo se resolvió contando las sesiones abiertas, con un índice parcial.
**Commit(s):** propios ninguno; del equipo `7862d54`, `23cf2ff`, `f4bbfdc` (Martín)

### Máximo Retamoso

**Fecha:** 2026-09-12
**Actividad:** Definición con Martín del funcionamiento de los pagos (RF-13, RF-14) y de los módulos de soporte (sedes, franjas, precios e instructores): pasarela simulada que devuelve un token, membresía creada solo con el pago aprobado, paso de externo a socio y comprobante PDF por pago. Martín los implementó; yo los probé con cuentas de prueba (pago de membresía, pago de cancha, comprobante, alta de sedes y precios).
**Decisión:** Los montos se calculan siempre en el servidor, y las clases vienen incluidas en la membresía (RN-03).
**Problema encontrado:** El doble clic al pagar podía cobrar dos veces. Martín lo resolvió con un bloqueo de la fila y verificando si ya había un pago (el segundo intento recibe 409); en las pruebas verifiqué que no se duplica el cobro.
**Commit(s):** propios ninguno; del equipo `7862d54`, `13b0d95`, `f07fa62`, `26dfa17` (Martín)

### Máximo Retamoso

**Fecha:** 2026-09-14
**Actividad:** Redacción de ADR-0008 sistema de auditoría en dos capas (FT1-22): interceptor con @Auditable para contexto de app + trigger en Postgres sobre pagos para cubrir cambios directos, con redacción automática de secretos.
**Decisión:** dos capas complementarias (interceptor + trigger).
**Problema encontrado:** el detalle JSON guardaba tokens; se agregó redacción automática de secretos + migración.
**Commit(s):** `1802fc4`, `068e8b6`

## UNIDAD III — PATRONES

### Martín Zanandrea

**Fecha:** 2026-08-20
**Actividad:** Implementación de Strategy (pricing dinámico de canchas), Observer (lista de espera de clases vía EventEmitter2) y Repository (anti-sobreventa de canchas con lock pesimista) para RF-11, RF-08 y RN-02 respectivamente.
**Decisión:** (no aplica — primera implementación de los tres patrones)
**Problema encontrado:** (no aplica — detectado en la auditoría posterior, ver siguiente entrada)
**Commit(s):** `cdca2b6`, `5552f69`

### Martín Zanandrea

**Fecha:** 2026-09-15
**Actividad:** Auditoría crítica de los 3 patrones ya implementados, que reveló que Strategy y Repository estaban "mal aplicados" pese a funcionar correctamente: el Strategy no era polimórfico real (el Context conocía las clases concretas e iteraba con if/else en vez de un array inyectado), y el Repository no tenía ninguna interfaz/abstracción (una única clase concreta, imposible de sustituir en tests).
**Decisión:** refactorizar ambos a su forma canónica — Strategy con inyección de array por token (PRICING_STRATEGIES) y Repository con interfaz (IBookingCanchaRepository) + token de inyección + una segunda implementación in-memory para tests futuros de Unidad V.
**Problema encontrado:** ninguna regresión de comportamiento tras el refactor (verificado con los mismos 4 casos de prueba antes/después).
**Commit(s):** `2c6c8d7`

### Teo Ava

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

**Fecha:** 2026-09-18
**Actividad:** Definí con Martín cómo armar el documento de justificación de los tres patrones GoF: Strategy en el precio dinámico (RF-11), Observer en la lista de espera (RF-08) y Repository con bloqueo pesimista contra la sobreventa (RN-02). Para cada uno, qué problema resuelve, por qué se eligió frente a las alternativas y qué costo tiene. La redacción la hizo casi toda Martín.
**Decisión:** Documentar para cada patrón el porqué y la alternativa descartada, en lugar de solo describir la implementación.
**Problema encontrado:** Al repasar los patrones para justificarlos noté que la primera versión de Strategy no era polimórfica de verdad, porque el calculador conocía las clases concretas. Se lo planteé a Martín, que hizo el refactor a la forma canónica: arreglo de estrategias inyectado por el token PRICING_STRATEGIES y Repository con interfaz e implementación en memoria para las pruebas.
**Commit(s):** propios ninguno; del equipo `cdca2b6`, `5552f69` (Martín, 20/08), `2c6c8d7` (Martín, refactor, 15/09)

## UNIDAD IV — COMPONENTES

### Martín Zanandrea

**Fecha:** 2026-08-27
**Actividad:** Sistema de componentes reutilizables (shared/components/ui.tsx), estado global de autenticación (AuthContext + useAuth), y capa de servicio (\*.api.ts por módulo de dominio) conectada al backend vía instancia compartida de Axios con interceptor de sesión.
**Decisión:** (no aplica — implementación según diseño del frontend)
**Problema encontrado:** loop de redirección infinita al recargar /login, causado por el interceptor de 401 redirigiendo incluso cuando el error 401 en /auth/me era el comportamiento esperado (usuario sin sesión); se resolvió excluyendo ese endpoint específico y la propia página de login de la redirección automática.
**Commit(s):** `71c2f71`, `f8daf45`, (no identificado — completar manualmente)

### Teo Ava

**Fecha:** 2026-08-24 a 2026-10-08
**Actividad:** Estado global y comunicación entre componentes (FT1-28): AuthContext como estado global de sesión (usuario, login/logout) consumido vía hook useAuth() sin prop-drilling, y ProtectedRoute como guardia que lee ese estado para redirigir por rol y sede.
**Decisión:** Context en vez de librería externa: el estado global real es solo la sesión.
**Problema encontrado:** loop de redirección infinita al recargar /login por el interceptor de 401; se excluyó /auth/me y la propia página de login.
**Commit(s):** `71c2f71`, `6e4ed9a`

### Teo Ava

**Fecha:** 2026-09-23 a 2026-10-09
**Actividad:** Pantallas del socio/cliente (FT1-47, En curso): Dashboard con reparto Socio/Externo, Mi QR, membresía, reservas de clases y canchas, pagos, notificaciones y cuenta.
**Decisión:** (no aplica — en curso según diseño existente)
**Problema encontrado:** (En curso) detalles pendientes: texto de auto-actualización del QR, link de reservar-clases en menú de externo y shell de /mi-cuenta para staff.
**Commit(s):** `98f7645`, `9f46ceb` (tarea En curso al 2026-10-11)

### Máximo Retamoso

**Fecha:** 2026-10-05
**Actividad:** Definí con Martín el contenido y el diseño de la landing pública multipágina (inicio, clases, canchas, sedes, nosotros, con navegación compartida), que programó él. Al probar la navegación encontré que al cambiar de ruta la página no volvía arriba, y lo arreglé con un componente global ScrollToTop.
**Decisión:** Un layout público único (PublicLayout) en vez de repetir la navegación en cada página, y un arreglo global del scroll en vez de parchear página por página.
**Problema encontrado:** React Router conserva el scroll entre rutas y el frontend no tenía ningún manejo de scroll. Lo diagnostiqué comparando el scroll más un clic contra una recarga de la página.
**Commit(s):** propios `b3ec7c3` (fix del scroll); del equipo `9f46ceb` (Martín, landing)

### Máximo Retamoso

**Fecha:** 2026-10-06
**Actividad:** Reorganización con Atomic Design (FT1-32): átomos (10 piezas, un archivo por componente), moléculas (12), organismos (layouts) con barrels index.ts + README del sistema; formatMoney a shared/utils; eliminado código muerto (ui.tsx partido, Donut duplicado, Reveal/Layout sin uso). Rama refactor/atomic-design, build limpio.
**Decisión:** un archivo por componente + barrels por nivel en vez de cajón único; mover sin cambiar comportamiento.
**Problema encontrado:** el build marcó dos errores tras el move (rutas relativas e import de barrel); se corrigieron y el build quedó limpio.
**Commit(s):** `772b856` (mergeado a main con PR #1)

### Máximo Retamoso

**Fecha:** 2026-10-11
**Actividad:** Discutí con Martín las pantallas del nuevo rol Gerente de Sede, que programó él. Las verifiqué con una cuenta de prueba: login, panel propio y las 10 pantallas del rol (personal, canchas, clases, reservas, reportes, pagos, membresías, instructores y acceso), cargando los datos de su sede.
**Decisión:** Cerrar la tarea como Listo después de una verificación funcional por rol, y no solo revisando el código.
**Problema encontrado:** En la verificación encontré algunas cosas para corregir y se las pasé a Martín. También revisé el alcance por sede: el gerente de sede solo ve datos de su sede en personal, reservas y reportes.
**Commit(s):** propios ninguno; del equipo `13b0d95`, `f07fa62` (Martín)

## UNIDAD V

### Martín Zanandrea

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Teo Ava

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

**Fecha:** 2026-10-13
**Actividad:** Pruebas manuales en producción (FT1-30/54/55: 20 ejecutadas, 2 parciales) con cuentas de prueba por rol, y reporte en docs/PRUEBAS.md con tablas por grupo, plantilla y hallazgos (FT1-56). Incluye registro con mail real verificado, compra en cuenta fresca, doble clic en cuenta propia sin duplicado y baja de clase TEST con aviso. Limpieza verificada en base: sin sesiones ni reservas abiertas.
**Decisión:** probar contra producción (como pide el plan) con cuentas de prueba, cancelando/cerrando todo lo creado en el acto; no ejecutar mail masivo por riesgo a socios reales.
**Problema encontrado:** sin clase casi llena no hay última plaza real (se probó carrera en paralelo sin duplicados); throttle de login confirmado al 6.º intento.
**Commit(s):** `5371015` (reporte docs/PRUEBAS.md, mergeado a main con el PR #2)

### Máximo Retamoso

**Fecha:** 2026-11-09
**Actividad:** Pruebas de integración contra PostgreSQL real para RN-01 y RN-02 (FT1-59): diez reservas simultáneas de la misma cancha confirman exactamente una, dos ingresos simultáneos del mismo socio en sedes distintas registran uno solo y el cupo de una clase no se excede bajo concurrencia; umbral de cobertura en package.json y jobs de integración y Docker en el CI. Endurecimiento del QR (FT1-64): token de un solo uso con jti y la violación del índice de RN-01 (23505) devuelta como 409 en lugar de 500 en los tres tipos de ingreso.
**Decisión:** Probar la concurrencia contra PostgreSQL real y no solo con repositorios en memoria, porque los dobles no reproducen el SELECT … FOR UPDATE ni los índices únicos parciales. Para el QR de un solo uso, guardar los jti usados en memoria hasta que vencen (viven 60 segundos) en vez de una tabla, y traducir el error 23505 en la función común de registro del ingreso, así cubre QR, código y DNI.
**Problema encontrado:** Ese mismo día Martín subió el ingreso por DNI y chocaba con mi versión: me quedé con la suya y volví a aplicar solo el endurecimiento sobre su código. Ahí apareció que su versión traducía el 23505 únicamente para el DNI, y con QR y con código seguía saliendo 500. Además, el script de las pruebas de integración borra la base, así que le agregué un resguardo: exige INTEGRACION_DB=true y se niega a correr contra Supabase.
**Commit(s):** `009914b`, `c2d8e0e`

## UNIDAD VI

### Martín Zanandrea

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Teo Ava

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

## CIERRE

### Martín Zanandrea

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Teo Ava

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

**Fecha:** 2026-11-09
**Actividad:** Cierre de los requisitos de admisibilidad de la entrega (sprint 7, Integración): migraciones reproducibles desde una base vacía con su reversión y script de migración; datos de prueba con 25 sedes; almacenamiento de archivos intercambiable y docker compose up --build; escaneo de secretos del historial completo; los diez ADR obligatorios en la plantilla del Anexo B; diagramas C4, DER, despliegue y pipeline; corrección de la carga de clases (429 con 25 sedes) y de los plazos de cancelación mostrados; integración con la reestructura backend/frontend; los tres manuales; README.
**Decisión:** Escribir un script de migraciones propio sobre los SQL que ya existían, en lugar de las migraciones de TypeORM, porque el esquema usa restricciones que el ORM no genera (índices únicos parciales, exclusión GiST, triggers). Hacer intercambiable el almacenamiento de archivos para que Docker funcione sin Supabase.
**Problema encontrado:** Las migraciones no levantaban una base vacía: 002 repetía lo del 001 y faltaban GERENTE_SEDE y la tabla de push. Con 25 sedes, la pantalla de reservar clases hacía más de 100 pedidos y la API respondía 429. El merge con la reestructura de carpetas de Martín dio conflictos en package.json, main.ts y el exportador de Swagger, que estaba duplicado: me quedé con el suyo.
**Commit(s):** `b101898`, `5f5f7b6`, `a63719c`, `6b33468`, `ab9b759`, `532fb99`, `849e354`, `74894a6`, `6713502`, `458225c`, `7a7b3a3`, `8b605ad`, `86452ab`, `a5b6a03`, `79faad7`, `32a2ca8`

## TRABAJO ADICIONAL RELEVANTE

### Martín Zanandrea

**Fecha:** 2026-09-09
**Actividad:** Rediseño completo del modelo de clases grupales, de eventos únicos a plantillas recurrentes semanales con generación automática de ocurrencias (ventana móvil de 4 semanas vía cron), motivado por una revisión de cómo opera un gimnasio real.
**Decisión:** asumir una sola "sala" compartida por sede (sin dato explícito en el enunciado original), documentado en su propio ADR.
**Problema encontrado:** tras el refactor, un endpoint del dashboard gerencial quedó referenciando una columna eliminada del modelo viejo (horarioInicio en Clase), causando un error 500 en el 100% de los casos hasta ser detectado y corregido.
**Commit(s):** `7a06627`, (no identificado — completar manualmente)

### Martín Zanandrea

**Fecha:** 2026-09-08
**Actividad:** Ronda de hardening de seguridad — scoping por sede fail-closed (antes fallaba abierto ante datos incompletos), validación de membresía activa al generar/usar el QR de acceso (RF-04), validación real de archivos subidos (tipo y tamaño), y confirmación de contraseña actual al cambiarla.
**Decisión:** (no aplica — correcciones sobre criterios ya documentados en ADR 0005 y RN-03)
**Problema encontrado:** dos services (membresías y opciones de cobro en efectivo) tenían el mismo patrón de "fail-open" ante un Recepcionista sin sede asignada, devolviendo datos de todas las sedes en vez de ninguna — corregido en ambos con el mismo criterio.
**Commit(s):** `cba51e9`, `2c6c8d7`
