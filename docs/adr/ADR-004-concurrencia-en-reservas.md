# ADR-004 — Control de concurrencia en la reserva de canchas: bloqueo pesimista más índice único

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

RN-02 exige que si dos usuarios reservan la misma cancha en el mismo horario y en el mismo segundo, solo uno tenga éxito. El flujo de reserva lee la disponibilidad, calcula el precio y recién después inserta: sin control, dos transacciones pueden leer "libre" a la vez e insertar las dos. El mismo problema aparece en el último cupo de una clase (RF-07) y en la membresía de un socio (ADR-022). Esta decisión estaba repartida entre el ADR-001, la nota del ADR-018 y la bitácora; se registra acá de forma explícita.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| Bloqueo optimista (columna `version`) | No bloquea lecturas; bueno con poca contención | El perdedor recibe un error de versión y hay que reintentar; la fila que cambia (la reserva) todavía no existe al momento de leer, así que no hay versión que comparar | No protege la inserción de una fila nueva |
| Solo índice único en la base | Garantía absoluta, sin código | El perdedor recibe un 23505 genérico; no cubre reglas que no son igualdad (bloqueos de mantenimiento, cupo de clases) | Se usa, pero como red de seguridad, no como único mecanismo |
| Nivel de aislamiento SERIALIZABLE | La base detecta cualquier anomalía | Errores de serialización que hay que reintentar en todo el código; más difícil de razonar | Demasiado amplio para un problema localizado |
| **`SELECT ... FOR UPDATE` sobre la cancha + índice único parcial** | Serializa solo las reservas de esa cancha; el chequeo posterior es confiable; la base rechaza cualquier duplicado igual | Dos reservas de horarios distintos de la misma cancha esperan una a la otra unos milisegundos | Elegida |

## Decisión

Usamos **bloqueo pesimista** dentro de una transacción: `TypeOrmBookingCanchaRepository.crearReservaSegura` toma `SELECT ... FOR UPDATE` sobre la fila de la cancha, verifica mantenimiento, bloqueos y reservas confirmadas en ese horario, e inserta. Como garantía en la base, el índice único parcial `uq_cancha_horario_confirmado (cancha_id, fecha, hora_inicio) WHERE estado = 'CONFIRMADA'` rechaza cualquier duplicado aunque se saltee el servicio. El perdedor recibe **409 Conflict** con el mensaje "Ese horario ya fue reservado para esta cancha". Las clases usan el mismo patrón con el lock sobre la ocurrencia (`TypeOrmBookingClaseRepository`).

## Consecuencias

- **Positivas:** RN-02 verificada contra Postgres real: 10 reservas simultáneas confirman exactamente una (`backend/test/integracion/reserva-cancha.int-spec.ts`); el lock es por cancha, así que otras canchas no esperan; una reserva cancelada libera el horario porque el índice es parcial.
- **Negativas:** las reservas de la misma cancha se serializan; el índice cubre igualdad de hora de inicio, por lo que turnos superpuestos con distinto inicio dependen del lock y de que los turnos sean de una hora en punto (`turnos-cancha.ts`).
- **Deuda asumida:** si se permitieran turnos de duración libre, habría que reemplazar el índice por una restricción de exclusión sobre el rango horario (como la de membresías).

## Requisitos relacionados

RN-02, RF-10, RF-07
