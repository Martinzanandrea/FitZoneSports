# ADR 0007: Cálculo de montos de pago exclusivamente server-side

## Estado
Aceptado

## Contexto
El flujo de pago recibía el monto directamente del cliente para membresías, reservas de clase y reservas de cancha, sin validarlo contra ninguna fuente de verdad del backend, lo que permitía manipular el monto efectivamente pagado. Tampoco existía una forma de que el Gerente modificara el precio de los planes de membresía sin desplegar código nuevo.

## Decisión
Vamos a usar una tabla de precios de membresía, editable exclusivamente por el rol Gerente, como fuente de verdad del precio de cada plan, y recalcular siempre el monto real del lado del servidor: desde esa tabla para membresías, y desde el precio final ya calculado y persistido al momento de reservar para las canchas, ignorando cualquier monto que envíe el cliente en ambos casos.

## Consecuencias
Cierra el vector de manipulación de precios en membresías y canchas: el monto pagado ya no depende de lo que declare el cliente. El Gerente puede modificar el precio de los planes desde la aplicación, sin necesidad de un nuevo despliegue. Como contrapartida, las reservas de clase quedan como la única excepción sin un precio gestionado por el backend, dado que el alcance actual del proyecto no define un modelo de precios para ese tipo de reserva.
