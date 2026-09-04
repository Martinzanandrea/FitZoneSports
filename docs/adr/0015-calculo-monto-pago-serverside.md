# ADR 0015: Cálculo de montos de pago server-side

## Estado

Aceptado

## Contexto

El flujo de pago recibía el campo `monto` directamente del cliente para
los tres tipos de referencia posibles (membresía, reserva de clase,
reserva de cancha), sin validarlo contra ninguna fuente de verdad del
backend. Esto permitía que un cliente manipulado enviara cualquier
monto arbitrario, ignorando el precio real de una membresía o el
`precioFinal` ya calculado por el patrón Strategy al reservar una
cancha. Tampoco existía forma de que el Gerente modificara el precio de
los planes de membresía sin tocar código.

## Decisión

Vamos a usar una tabla `precios_plan` (editable exclusivamente por
`GERENTE`) como fuente de verdad del precio de cada plan de membresía, y
recalcular siempre el monto real del lado del servidor — desde
`precios_plan` para membresías, y desde el `precioFinal` ya persistido
por el Strategy para canchas — ignorando cualquier `monto` enviado por
el cliente en esos dos casos.

## Consecuencias

Cierra el vector de manipulación de precios en membresías y canchas: el
monto pagado ya no depende de lo que envíe el cliente. El Gerente puede
modificar el precio de los planes desde la aplicación, sin despliegue de
código. Como contrapartida, `monto` en el DTO pasa a ser opcional y
queda como el único mecanismo real para reservas de clase, que no tiene
un modelo de precio propio en el backend — si en el futuro se define un
precio para clases, hay que extender el mismo cálculo server-side en
vez de seguir confiando en lo que mande el cliente.
