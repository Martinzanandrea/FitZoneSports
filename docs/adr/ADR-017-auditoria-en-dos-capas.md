# ADR-017 — Sistema de auditoría en dos capas: interceptor de aplicación y trigger de base

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

El sistema no contaba con ningún mecanismo para registrar quién realizó una acción sensible ni en qué momento. Se evaluó un interceptor a nivel de aplicación, que identifica al actor a través del JWT pero solo cubre los cambios que pasan por la API, frente a triggers de base de datos, que cubren cualquier cambio sobre una tabla mismo si ocurre por fuera de la aplicación, pero no tienen forma de identificar al usuario de la aplicación que lo originó.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Interceptor + trigger en pagos** | Contexto completo del actor y cobertura de cambios fuera de la API en la tabla más sensible | Dos lugares donde mirar | Elegida |
| Solo interceptor | Contexto rico | No ve cambios hechos directo en la base | Deja abierta la evasión de la API |
| Solo triggers | Cubre todo cambio | No identifica al usuario de la aplicación | Pierde el contexto |

## Decisión

Vamos a usar ambos mecanismos con responsabilidades distintas: un decorador de auditoría junto con un interceptor global como capa principal, que registra el contexto completo (actor, acción, entidad afectada) de toda acción sensible realizada a través de la API; y un trigger de Postgres en la tabla de pagos —la de mayor sensibilidad financiera del sistema— como capa adicional, que deja constancia de cualquier cambio sobre esa tabla ocurrido fuera de la aplicación.

## Consecuencias

- **Positivas:** trazabilidad de acciones sensibles; defensa ante cambios directos en pagos.
- **Negativas:** el trigger no tiene contexto de aplicación.
- **Deuda asumida:** los datos sensibles en `detalle` se redactan (migración 008).

## Requisitos relacionados

RF-13, RNF-02

## Detalle de las consecuencias

La capa de interceptor cubre el uso normal del sistema con contexto rico y legible. La capa de trigger cierra el vector de "alguien con acceso directo a la base de datos evade la aplicación", específicamente en la tabla más sensible. Como contrapartida, mantener dos mecanismos implica dos lugares distintos donde revisar qué ocurrió sobre la tabla de pagos, y el trigger no puede enriquecerse con contexto de aplicación, como identificar si un cambio provino de un recepcionista cobrando o de la propia pasarela de pago.

> Originalmente ADR 0008. Contenido sin cambios, adaptado a la plantilla del Anexo B.
