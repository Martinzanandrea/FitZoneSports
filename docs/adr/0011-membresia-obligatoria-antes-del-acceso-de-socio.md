# ADR 0011: Flujo de membresía y pago obligatorio antes del dashboard del Socio

## Estado

Aceptado

## Contexto

RF02 exige que un Socio tenga un plan de membresía (Mensual/Trimestral/Anual) para operar como tal dentro del sistema — el descuento de socio (RN03) y buena parte del valor de negocio dependen de que exista una membresía activa asociada. El registro público (RF01) solo crea el usuario; no obliga a elegir plan ni a pagar. Sin un paso adicional, un Socio recién registrado podía llegar directo al dashboard sin ninguna membresía asociada, dejando el sistema en un estado de negocio incompleto (un "socio" sin plan no es distinguible operativamente de un error de datos).

Un Cliente Externo (A2) no requiere este paso: por definición no tiene membresía, paga tarifa completa por cada uso.

Adicionalmente, el endpoint `POST /membresias` estaba restringido exclusivamente a `RECEPCIONISTA`/`GERENTE` (pensado originalmente solo para alta en mostrador), lo que bloqueaba que un Socio pudiera crear su propia membresía como parte de un flujo de autoservicio.

## Decisión

Vamos a usar un flujo obligatorio de elegir plan + sede + pagar (`/completar-membresia`) intercalado entre el registro y el acceso al dashboard, aplicable únicamente cuando `tipoActor === SOCIO`. Vamos a relajar el endpoint `POST /membresias` de un `@Roles` fijo a una validación de ownership (`assertOwnerOrStaff`): cualquier usuario autenticado puede crear una membresía, pero únicamente si el `usuarioId` del payload coincide con su propia identidad; el personal (`RECEPCIONISTA`/`GERENTE`) conserva la capacidad de crear membresías para cualquier usuario, como antes.

## Consecuencias

Así ningún Socio queda en estado incompleto tras su propio registro porque el flujo lo fuerza antes de dejarlo entrar al área de cliente, y `POST /membresias` gana el caso de uso de autoservicio sin perder el de alta en mostrador, reutilizando el mismo helper de ownership ya usado en `pagos`, `acceso`, `clases` y `canchas` de forma consistente con el backend. Como limitación, la redirección a `/completar-membresia` es una decisión tomada en el cliente y no impuesta por el backend, por lo que un usuario que navegue manualmente a `/dashboard` sin completar el pago no es bloqueado a nivel de API, aunque el acceso a datos sensibles como descuentos (RN03) sigue protegido server-side, y esta posibilidad queda aceptada como limitación conocida no bloqueante. También queda como asimetría que el monto cobrado en este flujo está definido como constante en el frontend (`CompletarMembresia.tsx`) y no es validado ni calculado por el backend, a diferencia del pricing de canchas que sí usa el patrón Strategy server-side, una deuda técnica documentada. El cumplimiento es verificable en `client/src/modules/usuarios/pages/RegistroPage.tsx` con la redirección condicional por `tipoActor`, en `client/src/modules/membresias/pages/CompletarMembresia.tsx` y en `server/src/membresias/membresias.controller.ts` con el método `create` sin `@Roles` y con `assertOwnerOrStaff`. Como mejora futura queda pendiente mover los precios de los planes al backend (tabla o configuración) y validar server-side el monto recibido en `POST /pagos/pasarela` contra el precio real del plan asociado, para cerrar la asimetría y alinearse con el pricing de canchas (RF11, patrón Strategy).
