# ADR 0003: PostgreSQL como motor de base de datos

## Estado

Aceptado

## Contexto

El sistema maneja inventario de reservas (canchas, clases con cupo limitado) y pagos, donde la integridad de los datos y el control de concurrencia son requisitos no negociables (RN01, RN02, RNF02). Se evaluó PostgreSQL frente a alternativas NoSQL (MongoDB) y frente a MySQL.

## Decisión

Vamos a usar PostgreSQL como motor de base de datos, por su soporte transaccional ACID completo, sus constraints declarativos a nivel de esquema (`CHECK`, `UNIQUE`, índices parciales), su soporte nativo de tipos `ENUM` y `UUID` (vía `pgcrypto`), y su capacidad de expresar reglas de negocio directamente en el schema en lugar de depender únicamente de la capa de aplicación.

## Consecuencias

Con esta decisión RN01 (un usuario no puede estar en 2 sedes a la vez) y RN02 (anti-sobreventa de canchas) quedan garantizados con índices únicos parciales a nivel de base de datos y no solo con validación en código, el patrón "exclusive arc" permite integridad referencial real en `pagos` que una base NoSQL no puede garantizar de forma nativa, y las migraciones quedan controladas y versionadas vía TypeORM evitando esquemas implícitos entre entornos. A cambio se resigna algo de flexibilidad frente a cambios muy frecuentes de forma de los datos propios de NoSQL, algo no relevante para este dominio altamente estructurado. La implementación es verificable en `fitzone_schema.sql` por la extensión `pgcrypto`, los tipos `ENUM` nativos, los índices únicos parciales (`uq_acceso_abierto_por_usuario`, `uq_cancha_horario_confirmado`) y los `CHECK` constraints (`chk_pago_referencia_unica`, `chk_pago_metodo_datos`). La base está alojada en Supabase (PostgreSQL gestionado), lo que además aporta backups automáticos y Storage integrado para fotos y comprobantes en PDF sin necesidad de un servicio separado.
