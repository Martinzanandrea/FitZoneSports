# ADR 0018: Sistema de auditoría en dos capas

## Estado

Aceptado

## Contexto

El sistema no tenía ningún mecanismo para registrar quién realizó una
acción sensible ni cuándo. Se evaluaron dos enfoques: un interceptor a
nivel de aplicación (sabe quién actuó, vía JWT, con nombres de acción
legibles, pero solo cubre cambios que pasan por la API) y triggers de
Postgres (cubren cualquier cambio en la tabla, incluso hecho fuera de
la aplicación, pero no tienen noción nativa de qué usuario de la app
ejecutó la query, ya que todas las conexiones usan el mismo rol de
base de datos).

## Decisión

Vamos a usar ambos mecanismos, con responsabilidades distintas: un
decorador `@Auditable(accion, entidad)` + un `AuditoriaInterceptor`
global como capa principal, que captura el contexto de negocio completo
(actor, acción semántica, payload) para toda acción sensible que pase
por la API; y un trigger de Postgres en la tabla `pagos` específicamente
— la más sensible del sistema — como capa adicional de defensa en
profundidad, que registra cualquier `INSERT`/`UPDATE`/`DELETE` sobre esa
tabla incluso si ocurre fuera de la aplicación (por ejemplo, alguien
editando directo en el SQL Editor de Supabase), sin poder identificar
al actor humano pero dejando constancia del cambio crudo.

## Consecuencias

La capa de interceptor cubre el uso normal del sistema con contexto
rico y legible; la capa de trigger cierra el vector de "alguien con
acceso directo a la base evade la aplicación", específicamente en la
tabla de mayor sensibilidad financiera. Ambas capas escriben en la
misma tabla `auditoria`, distinguibles por el campo `accion` (los
registros del trigger usan un prefijo `DB_` y no tienen `actor_id`).
Como contrapartida, mantener dos mecanismos duplica el lugar donde hay
que mirar para entender "qué pasó" en `pagos`, y el trigger no puede
enriquecerse con contexto de aplicación (por ejemplo, no sabe si un
cambio vino de un recepcionista cobrando o de la pasarela); si en el
futuro se necesitara saber quién hizo un cambio manual en la base,
haría falta adoptar el patrón `SET LOCAL app.current_user_id` en cada
conexión, evaluado y descartado por ahora por la complejidad que
agrega frente al beneficio para el alcance actual del proyecto.
