# ADR 0004: Supabase como base de datos gestionada en la nube

## Estado

Aceptado

## Contexto

El equipo de 3 integrantes trabaja de forma distribuida, sin un servidor propio disponible. Una base de datos local (instalada en la máquina de un solo integrante) impediría que el resto del equipo desarrollara y probara contra el mismo estado de datos, y dificultaría el despliegue posterior a producción. Se evaluó instalar PostgreSQL localmente para cada integrante (con el problema de desincronización de esquemas) contra un servicio gestionado en la nube.

## Decisión

Vamos a usar Supabase como proveedor gestionado de PostgreSQL, accesible por los 3 integrantes del equipo y por el backend desplegado mediante una única cadena de conexión compartida, sumando además su servicio de Storage para archivos (fotos de perfil, comprobantes de pago) sin necesidad de un proveedor de almacenamiento separado.

## Consecuencias

Todo el equipo desarrolla y prueba siempre contra el mismo estado real de datos, eliminando divergencias entre entornos locales. No requiere administrar infraestructura de base de datos propia (backups, actualizaciones, alta disponibilidad), delegada al proveedor. Como contrapartida, introduce una dependencia de un tercero externo y de conectividad a internet incluso durante el desarrollo local, y el plan gratuito impone límites de cómputo y almacenamiento que deben monitorearse a medida que crece el volumen de datos de prueba.
