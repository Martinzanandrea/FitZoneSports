# ADR-002 — PostgreSQL como motor de base de datos relacional

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

El sistema maneja pagos, reservas con cupo y membresías con vigencia: datos con relaciones fuertes y reglas que deben valer aunque falle la aplicación (no sobreventa, una sola sesión de acceso abierta por socio, membresías sin superposición). La consulta de disponibilidad de canchas tenía que responder en milisegundos (RNF-03) y el equipo necesitaba una base compartida por los cuatro integrantes desde el primer sprint, sin administrar servidores. Esta decisión formaba parte del ADR 0003 original (stack, hoy ADR-005); se separa para registrar contra qué se eligió.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **PostgreSQL (en Supabase)** | ACID, índices únicos parciales, restricciones de exclusión, `FOR UPDATE`, tipos ENUM y NUMERIC exactos; plan gratuito administrado | Dependencia de un proveedor externo; migraciones manuales | Elegida |
| MySQL / MariaDB | Conocido, ACID con InnoDB | Sin índices únicos parciales ni restricciones de exclusión: RN-01 y la no superposición de membresías quedarían solo en la aplicación | Menos garantías declarativas en la base |
| MongoDB | Esquema flexible, rápido para prototipar | Transacciones multi-documento más limitadas; sin claves foráneas; las reglas de integridad pasan al código | La integridad transaccional es el requisito central del caso |
| SQLite | Cero instalación | Un solo escritor a la vez, sin servidor compartido para el equipo ni para producción | No sirve para un entorno multiusuario desplegado |

## Decisión

Usamos **PostgreSQL** como única base de datos, alojada en Supabase en producción y en un contenedor `postgres:17` en desarrollo (ver ADR-009). El criterio determinante fue poder declarar en la propia base las reglas críticas: índice único parcial `uq_cancha_horario_confirmado` (RN-02), índice único parcial `uq_acceso_abierto_por_usuario` (RN-01), restricción de exclusión GiST para membresías (ADR-022) e índices de disponibilidad (RNF-03).

## Consecuencias

- **Positivas:** las reglas de negocio críticas quedan garantizadas aunque haya un error en el código o un acceso directo a la base; tipos exactos para montos (NUMERIC); un solo motor para datos transaccionales y reportes.
- **Negativas:** producción depende de la disponibilidad de Supabase; el esquema se gestiona con scripts SQL propios en lugar de migraciones generadas por el ORM; agregar un valor a un ENUM requiere una migración.
- **Deuda asumida:** los reportes consolidados de las 25 sedes corren sobre la misma base que las transacciones; con mucho volumen habría que pasarlos a una réplica de lectura.

## Requisitos relacionados

RNF-03, RN-01, RN-02, RF-13
