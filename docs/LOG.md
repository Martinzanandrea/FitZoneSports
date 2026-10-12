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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

**Fecha:** 2026-09-02
**Actividad:** Redacción de ADR-0001 GitHub como repositorio compartido (FT1-15) y de ADR-0002 Monolito Modular (FT1-16): ramas por integrante y versionado acoplado como costo aceptado.
**Decisión:** monorepo único cliente+servidor con formato Nygard de 5 campos.
**Problema encontrado:** numeración de ADRs con gaps tras varias iteraciones; se resolvió con renumeración basada en git log.
**Commit(s):** `612d9ce`, `068e8b6`, `e22cde0`

### Máximo Retamoso

**Fecha:** 2026-09-10
**Actividad:** M2 Gimnasio y Acceso (FT1-37, RF-04/RF-05/RN-01): QR dinámico de 60s + código corto de 6 dígitos de un solo uso, doble chequeo de membresía activa al generar y validar, aforo con conteo de sesiones abiertas y sesión única por usuario.
**Decisión:** JWT firmado de corta vida + revalidación en servidor en vez de QR estático.
**Problema encontrado:** la ventana de 60s entre generar y validar obligó al doble chequeo de membresía; aforo resuelto con índice parcial sobre sesiones abiertas.
**Commit(s):** `7862d54`, `f4bbfdc`, `23cf2ff`

### Máximo Retamoso

**Fecha:** 2026-09-12
**Actividad:** M5 Pagos (FT1-40, RF-13/RF-14) y módulos de soporte (FT1-42: sedes, franjas, precios, instructores): pasarela mock con token, membresía creada solo con pago APROBADO en la misma transacción, promoción EXTERNO→SOCIO, comprobante PDF 1:1 por pago; catálogo de tipos de cancha y ABM de sedes con franjas.
**Decisión:** montos siempre calculados en servidor y clases incluidas en membresía (RN-03).
**Problema encontrado:** el doble cobro concurrente se resolvió con lock pesimista + verificación de pago existente (409 al segundo intento).
**Commit(s):** `7862d54`, `26dfa17`, `f07fa62`, `13b0d95`

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
**Actividad:** Justificación escrita de los tres patrones GoF aplicados (FT1-26): Strategy en pricing dinámico (RF-11), Observer en lista de espera (RF-08) y Repository con lock pesimista anti-sobreventa (RN-02), con refactor a forma canónica (Strategy con array inyectado por token PRICING_STRATEGIES, Repository con interfaz + implementación in-memory para tests).
**Decisión:** documentar por qué cada patrón y qué alternativa se descartó.
**Problema encontrado:** la primera versión no era polimórfica real; se refactorizó a forma canónica y se verificó sin regresiones.
**Commit(s):** `cdca2b6`, `5552f69`, `2c6c8d7`

## UNIDAD IV — COMPONENTES

### Martín Zanandrea

**Fecha:** 2026-08-27
**Actividad:** Sistema de componentes reutilizables (shared/components/ui.tsx), estado global de autenticación (AuthContext + useAuth), y capa de servicio (\*.api.ts por módulo de dominio) conectada al backend vía instancia compartida de Axios con interceptor de sesión.
**Decisión:** (no aplica — implementación según diseño del frontend)
**Problema encontrado:** loop de redirección infinita al recargar /login, causado por el interceptor de 401 redirigiendo incluso cuando el error 401 en /auth/me era el comportamiento esperado (usuario sin sesión); se resolvió excluyendo ese endpoint específico y la propia página de login de la redirección automática.
**Commit(s):** `71c2f71`, `f8daf45`, (no identificado — completar manualmente)

### Teo Ava

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

**Fecha:** 2026-10-05
**Actividad:** Pantallas públicas del home/inicio y catálogos (FT1-48, Listo): landing multi-página (/, /clases, /canchas, /sedes, /nosotros) con nav compartido. Fix propio del nav que no volvía arriba al cambiar de ruta (componente ScrollToTop global).
**Decisión:** layout público único (PublicLayout) en vez de repetir nav en cada página; fix global en vez de parchar página por página.
**Problema encontrado:** react-router conserva el scroll entre rutas y no había ningún manejo de scroll en el frontend; se diagnosticó reproduciendo scroll + clic contra recarga.
**Commit(s):** `9f46ceb`, `b3ec7c3` (mergeado a main, en producción)

### Máximo Retamoso

**Fecha:** 2026-10-06
**Actividad:** Reorganización con Atomic Design (FT1-32): átomos (10 piezas, un archivo por componente), moléculas (12), organismos (layouts) con barrels index.ts + README del sistema; formatMoney a shared/utils; eliminado código muerto (ui.tsx partido, Donut duplicado, Reveal/Layout sin uso). Rama refactor/atomic-design, build limpio.
**Decisión:** un archivo por componente + barrels por nivel en vez de cajón único; mover sin cambiar comportamiento.
**Problema encontrado:** el build marcó dos errores tras el move (rutas relativas e import de barrel); se corrigieron y el build quedó limpio.
**Commit(s):** `772b856` (mergeado a main con PR #1)

### Máximo Retamoso

**Fecha:** 2026-10-11
**Actividad:** Cierre de FT1-50 rol Gerente de Sede (FT1-53 pantallas; endpoints FT1-51 de MZ y BD FT1-52 de TA, ya en main): login con cuenta de prueba, panel propio y las 10 pantallas del rol (personal, canchas, clases, reservas, reportes, pagos, membresías, instructores, acceso) cargando datos de su sede, sin 403 ni blancos.
**Decisión:** cerrar como Listo con verificación funcional por rol en vez de solo inspección de código.
**Problema encontrado:** sin bloqueantes: se verificó además el scope por sede (el GS solo ve datos de su sede en personal, reservas y reportes).
**Commit(s):** `f07fa62`, `13b0d95`

## UNIDAD V

### Martín Zanandrea

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Teo Ava

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

### Máximo Retamoso

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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
