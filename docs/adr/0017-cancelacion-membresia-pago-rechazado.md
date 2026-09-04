# ADR 0015: Cancelación de membresía tras pago rechazado

## Estado

Aceptado

## Contexto

Tras agregar la validación que impide crear una segunda membresía
`ACTIVO` para un mismo usuario (prevención de duplicados por reintento),
apareció un caso borde: si el pago de una membresía recién creada es
rechazado por la pasarela, la membresía queda en la base con estado
`ACTIVO` pero sin ningún pago aprobado asociado — y el usuario, al
reintentar, choca con el bloqueo de duplicados sin ninguna forma de
completar el pago pendiente ni de empezar de nuevo.

## Decisión

Vamos a usar un endpoint acotado `PATCH /membresias/:id/cancelar`
(disponible para el propio dueño de la membresía o para staff) que
cambia el estado a `SUSPENDIDO` en lugar de borrar la fila. El
frontend lo invoca automáticamente cuando `CompletarMembresia`
detecta que el pago fue rechazado, liberando así el bloqueo de
duplicados para que el usuario pueda reintentar con un plan y método
de pago nuevos.

## Consecuencias

Cierra el caso borde sin perder trazabilidad: la membresía con pago
fallido queda registrada como `SUSPENDIDO` en vez de desaparecer,
útil para auditoría de intentos fallidos. El usuario puede reintentar
sin quedar bloqueado. Como contrapartida, el flujo de registro de un
Socio ahora puede generar varias filas de membresía por usuario si
reintenta varias veces (una `SUSPENDIDO` por cada intento fallido)
antes de lograr un pago aprobado — aceptado, ya que ninguna de esas
filas queda en estado `ACTIVO` simultáneamente, y el reporte de
"membresía vigente" (`obtenerMembresiaVigente`) sigue devolviendo
siempre la más reciente por `fechaFin`, que en la práctica coincidirá
con la única `ACTIVO`.
