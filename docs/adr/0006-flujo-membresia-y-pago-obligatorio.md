# ADR 0006: Flujo obligatorio de membresía y pago, con recuperación ante pago rechazado

## Estado
Aceptado

## Contexto
RF-02 exige que un Socio tenga un plan de membresía vigente para operar como tal, pero el registro público solo creaba el usuario, sin obligarlo a elegir un plan ni completar el pago. Al forzar ese flujo y bloquear la creación de una segunda membresía activa por usuario, apareció un caso borde: si el pago de una membresía recién creada es rechazado por la pasarela, la membresía queda activa sin ningún pago aprobado, y el usuario no puede reintentar sin chocar con el bloqueo de duplicados.

## Decisión
Vamos a intercalar un paso obligatorio de elegir plan, sede y pagar entre el registro y el ingreso al panel del Socio, relajando la creación de membresías de un permiso exclusivo de personal a una validación de propiedad (el propio usuario puede crear su membresía). Si el pago resulta rechazado, el frontend invoca automáticamente un endpoint de cancelación que cambia el estado de esa membresía a Suspendido, liberando el bloqueo de duplicados para permitir un nuevo intento.

## Consecuencias
Ningún Socio queda en un estado de negocio incompleto tras su propio registro. El endpoint de creación de membresías gana un caso de uso de autoservicio sin perder el de alta en mostrador por parte del personal. El caso borde de pago rechazado queda resuelto sin perder trazabilidad, ya que la membresía fallida se conserva como Suspendido en lugar de borrarse. Como contrapartida, la redirección al flujo de pago es una decisión tomada en el cliente, no impuesta por el backend: un usuario podría navegar manualmente al panel sin completar el pago, aunque no accedería a ningún beneficio de socio activo mientras tanto. Además del control al momento de registrarse, la membresía activa también se valida como condición para reservar clases grupales (RN-03): reserva-clase.service.ts rechaza la reserva con un mensaje explícito si el usuario no tiene una membresía en estado ACTIVO al momento de reservar, aplicando el mismo criterio a reservas hechas por el propio socio o anotadas por personal de recepción en su nombre.
