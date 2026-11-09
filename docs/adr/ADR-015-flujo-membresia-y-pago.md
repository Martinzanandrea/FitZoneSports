# ADR-015 — Flujo obligatorio de membresía y pago, con recuperación ante pago rechazado

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

RF-02 exige que un Socio tenga un plan de membresía vigente para operar como tal, pero el registro público solo creaba el usuario, sin obligarlo a elegir un plan ni completar el pago. Al forzar ese flujo y bloquear la creación de una segunda membresía activa por usuario, apareció un caso borde: si el pago de una membresía recién creada es rechazado por la pasarela, la membresía queda activa sin ningún pago aprobado, y el usuario no puede reintentar sin chocar con el bloqueo de duplicados.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Paso obligatorio de plan, sede y pago tras el registro** | Ningún socio queda en estado incompleto | La redirección la decide el cliente | Elegida |
| Membresía solo en mostrador | Control total del personal | Sin autoservicio online | Contradice el flujo del Demo Day |
| Borrar la membresía si el pago falla | Sin filas huérfanas | Se pierde la trazabilidad del intento | Se prefirió SUSPENDIDO |

## Decisión

Vamos a intercalar un paso obligatorio de elegir plan, sede y pagar entre el registro y el ingreso al panel del Socio, relajando la creación de membresías de un permiso exclusivo de personal a una validación de propiedad (el propio usuario puede crear su membresía). Si el pago resulta rechazado, el frontend invoca automáticamente un endpoint de cancelación que cambia el estado de esa membresía a Suspendido, liberando el bloqueo de duplicados para permitir un nuevo intento.

## Consecuencias

- **Positivas:** registro y pago en un solo recorrido; trazabilidad del intento fallido.
- **Negativas:** un usuario podría navegar al panel sin pagar (sin beneficios).
- **Deuda asumida:** con la vigencia por fechas (ADR-022) la membresía se crea recién con el pago aprobado.

## Requisitos relacionados

RF-01, RF-02, RN-03

## Detalle de las consecuencias

Ningún Socio queda en un estado de negocio incompleto tras su propio registro. El endpoint de creación de membresías gana un caso de uso de autoservicio sin perder el de alta en mostrador por parte del personal. El caso borde de pago rechazado queda resuelto sin perder trazabilidad, ya que la membresía fallida se conserva como Suspendido en lugar de borrarse. Como contrapartida, la redirección al flujo de pago es una decisión tomada en el cliente, no impuesta por el backend: un usuario podría navegar manualmente al panel sin completar el pago, aunque no accedería a ningún beneficio de socio activo mientras tanto. Además del control al momento de registrarse, la membresía activa también se valida como condición para reservar clases grupales (RN-03): reserva-clase.service.ts rechaza la reserva con un mensaje explícito si el usuario no tiene una membresía en estado ACTIVO al momento de reservar, aplicando el mismo criterio a reservas hechas por el propio socio o anotadas por personal de recepción en su nombre.

> Originalmente ADR 0006. Contenido sin cambios, adaptado a la plantilla del Anexo B. Parcialmente superado por ADR-022.
