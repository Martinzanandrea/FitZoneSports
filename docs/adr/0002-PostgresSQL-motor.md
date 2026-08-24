# ADR 0002: PostgreSQL como motor de base de datos

## Estado

Aceptada

## Contexto

El sistema maneja inventario de reservas (canchas, clases con cupo
limitado) y pagos, donde la integridad de los datos y el control de
concurrencia son requisitos no negociables (RN01, RN02, RNF02). Se
evaluó PostgreSQL frente a alternativas NoSQL (MongoDB) y frente a
MySQL.

## Decisión

Utilizaremos **PostgreSQL** como motor de base de datos, por su soporte
transaccional ACID completo, sus constraints declarativos a nivel de
esquema (`CHECK`, `UNIQUE`, índices parciales), su soporte nativo de
tipos `ENUM` y `UUID` (vía `pgcrypto`), y su capacidad de expresar reglas
de negocio directamente en el schema en lugar de depender únicamente de
la capa de aplicación.

## Consecuencias

- (+) RN01 (un usuario no puede estar en 2 sedes a la vez) y RN02
  (anti-sobreventa de canchas) se garantizan con índices únicos
  parciales a nivel de base de datos, no solo con validación en el
  código de la aplicación.
- (+) El patrón "exclusive arc" (columnas FK nullables + `CHECK`) permite
  integridad referencial real en `pagos`, algo que una base NoSQL no
  puede garantizar de forma nativa.
- (+) Migraciones controladas y versionadas (vía TypeORM), evitando
  esquemas implícitos o inconsistentes entre entornos.
- (-) Menor flexibilidad que un NoSQL ante cambios de forma de los datos
  muy frecuentes (no es un problema relevante para este dominio, que es
  altamente estructurado).

## Cumplimiento

Verificable en `fitzone_schema.sql`: extensión `pgcrypto`, tipos `ENUM`
nativos, índices únicos parciales (`uq_acceso_abierto_por_usuario`,
`uq_cancha_horario_confirmado`), y `CHECK` constraints (`chk_pago_referencia_unica`,
`chk_pago_metodo_datos`).

## Notas

La base está alojada en Supabase (PostgreSQL gestionado), lo que suma
backups automáticos y una capa de Storage integrada para archivos
(fotos de usuario, comprobantes en PDF), sin necesidad de un servicio de
almacenamiento separado.
