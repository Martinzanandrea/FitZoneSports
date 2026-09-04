# ADR 0005: UUID como clave primaria en lugar de enteros autoincrementales

## Estado

Aceptado

## Contexto

El sistema está diseñado para escalar a 25+ sucursales (RNF04), cada una potencialmente generando registros de forma independiente (por ejemplo, altas de socios en distintas sedes). Con claves primarias enteras autoincrementales, dos sedes podrían generar el mismo ID para registros distintos, generando colisiones al centralizar o sincronizar datos. Adicionalmente, IDs secuenciales expuestos por la API permiten inferir volumen de datos y facilitan la enumeración de recursos por fuerza bruta.

## Decisión

Vamos a usar UUID generados con `gen_random_uuid()` de la extensión `pgcrypto` como clave primaria en todas las tablas, en lugar de enteros autoincrementales (`SERIAL`).

## Consecuencias

De este modo se elimina el riesgo de colisión de IDs entre sedes o entre entornos sin coordinación central, no se revela información de negocio a través de la API y se dificulta la enumeración por adivinanza, además de permitir generar el identificador antes de persistir el registro, útil para escenarios offline (RNF01: acceso QR sin conexión). El costo es un mayor tamaño por clave (16 bytes vs 4-8 bytes) y comparaciones de índice levemente más costosas, aceptable para la escala del proyecto. La adopción es verificable en `fitzone_schema.sql` donde toda tabla define `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, y en el código donde los DTOs usan `@IsUUID()` de `class-validator` y los parámetros de ruta usan `ParseUUIDPipe`.
