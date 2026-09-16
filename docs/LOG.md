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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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

_Pendiente — completar con actividades, decisiones y problemas encontrados propios, con referencia a sus commits reales._

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
