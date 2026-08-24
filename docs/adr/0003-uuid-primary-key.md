# ADR 0003: UUID como clave primaria en lugar de enteros autoincrementales

## Estado

Aceptada

## Contexto

El sistema está diseñado para escalar a 25+ sucursales (RNF04), cada una
potencialmente generando registros de forma independiente (por ejemplo,
altas de socios en distintas sedes). Con claves primarias enteras
autoincrementales, dos sedes podrían generar el mismo ID para registros
distintos, generando colisiones al centralizar o sincronizar datos.
Adicionalmente, IDs secuenciales expuestos por la API permiten inferir
volumen de datos y facilitan la enumeración de recursos por fuerza bruta.

## Decisión

Utilizaremos **UUID** (generados con `gen_random_uuid()` de la extensión
`pgcrypto`) como clave primaria en todas las tablas, en lugar de
enteros autoincrementales (`SERIAL`).

## Consecuencias

- (+) Elimina el riesgo de colisión de IDs entre sedes o entre entornos
  (desarrollo/producción) sin coordinación central.
- (+) No revela información de negocio (volumen de registros) a través
  de la API, y dificulta la enumeración de recursos por adivinanza de ID.
- (+) Permite generar el identificador antes de persistir el registro,
  útil para escenarios offline (RNF01: acceso QR sin conexión).
- (-) Mayor tamaño de almacenamiento por clave (16 bytes vs 4-8 bytes) y
  comparaciones de índice levemente más costosas que con enteros —
  aceptable para la escala del proyecto (no millones de transacciones
  por segundo).

## Cumplimiento

Verificable en `fitzone_schema.sql`: toda tabla define
`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. En el código, los
DTOs que reciben IDs de otras entidades usan el validador `@IsUUID()`
de `class-validator`, y los parámetros de ruta usan `ParseUUIDPipe`.

## Notas

Ninguna.
