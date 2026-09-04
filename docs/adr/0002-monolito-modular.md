# ADR 0001: Arquitectura Monolito Modular (no microservicios)

## Estado

Aceptado

## Contexto

FitZone Sports gestiona reservas de canchas y clases donde la sobreventa (RN02: dos reservas simultáneas para el mismo horario deben resolverse con una sola exitosa) es un riesgo de negocio crítico. El equipo de desarrollo es chico (un desarrollador), y el proyecto tiene un plazo académico acotado. Se evaluó una arquitectura de microservicios (un servicio por módulo: usuarios, reservas, pagos, etc.) contra un monolito modular (una sola aplicación, dividida internamente en módulos de dominio).

Los microservicios ofrecen escalabilidad y despliegue independiente por servicio, pero introducen transacciones distribuidas, mayor complejidad operativa (orquestación, descubrimiento de servicios, comunicación entre procesos) y mayor superficie de fallo — todo esto sin un equipo dedicado a mantenerlo.

## Decisión

Vamos a usar una arquitectura de Monolito Modular: una única aplicación NestJS desplegada como un solo proceso, organizada internamente en módulos independientes por dominio (`sedes`, `usuarios`, `membresias`, `clases`, `canchas`, `pagos`, `acceso`, `auth`), cada uno con su propio `controller`/`service`/`dto`, comunicándose entre sí de forma explícita a través de imports/exports de Nest. Esta decisión prioriza la integridad transaccional fuerte que da un único proceso conectado a una única base de datos (ACID real, sin necesidad de sagas ni compensación distribuida) sobre la escalabilidad horizontal independiente que ofrecería separar servicios.

## Consecuencias

Esta elección nos da transacciones ACID reales para RN01/RN02 sin complejidad adicional, ya que un `SELECT ... FOR UPDATE` dentro de una transacción de Postgres resuelve la concurrencia sin coordinar múltiples servicios, además de un despliegue simple con un solo build, un solo proceso y un solo dominio, y una menor curva de aprendizaje para un equipo de una persona. Como contrapartida, escalar un módulo específico (por ejemplo, `canchas` en horario pico) requiere escalar toda la aplicación, y un error no controlado en un módulo puede afectar la disponibilidad de los demás, aunque esto se mitiga con manejo de excepciones por capa. El cumplimiento es verificable revisando la estructura de `server/src` con un solo `AppModule` que importa los módulos de dominio, un solo proceso definido en `main.ts` y un solo comando de arranque en el hosting (Render). Si el proyecto creciera a un equipo más grande o necesitara escalar módulos de forma independiente, la división modular ya realizada facilita una futura extracción a microservicios sin un rediseño completo, porque los límites de dominio ya están establecidos.
