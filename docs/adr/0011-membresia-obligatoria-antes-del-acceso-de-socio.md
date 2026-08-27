# ADR 0011: Flujo de membresía y pago obligatorio antes del dashboard del Socio

## Estado

Aceptada

## Contexto

RF02 exige que un Socio tenga un plan de membresía (Mensual/Trimestral/
Anual) para operar como tal dentro del sistema — el descuento de socio
(RN03) y buena parte del valor de negocio dependen de que exista una
membresía activa asociada. El registro público (RF01) solo crea el
usuario; no obliga a elegir plan ni a pagar. Sin un paso adicional, un
Socio recién registrado podía llegar directo al dashboard sin ninguna
membresía asociada, dejando el sistema en un estado de negocio
incompleto (un "socio" sin plan no es distinguible operativamente de un
error de datos).

Un Cliente Externo (A2) no requiere este paso: por definición no tiene
membresía, paga tarifa completa por cada uso.

Adicionalmente, el endpoint `POST /membresias` estaba restringido
exclusivamente a `RECEPCIONISTA`/`GERENTE` (pensado originalmente solo
para alta en mostrador), lo que bloqueaba que un Socio pudiera crear su
propia membresía como parte de un flujo de autoservicio.

## Decisión

Utilizaremos un flujo obligatorio de **elegir plan + sede + pagar**
(`/completar-membresia`) intercalado entre el registro y el acceso al
dashboard, aplicable únicamente cuando `tipoActor === SOCIO`. El
endpoint `POST /membresias` se relaja de un `@Roles` fijo a una
validación de **ownership** (`assertOwnerOrStaff`): cualquier usuario
autenticado puede crear una membresía, pero únicamente si el
`usuarioId` del payload coincide con su propia identidad — el personal
(`RECEPCIONISTA`/`GERENTE`) conserva la capacidad de crear membresías
para cualquier usuario, como antes.

## Consecuencias

- (+) Ningún Socio queda en un estado de negocio incompleto (sin plan)
  tras su propio registro — el flujo lo fuerza antes de dejarlo entrar
  al área de cliente.
- (+) `POST /membresias` gana un caso de uso de autoservicio sin perder
  el caso de uso original de alta en mostrador, reutilizando el mismo
  helper de ownership ya usado en `pagos`, `acceso`, `clases` y
  `canchas` — consistente con el patrón general del backend.
- (-) La redirección a `/completar-membresia` es una decisión tomada en
  el cliente (frontend), no impuesta por el backend: un usuario que
  navegue manualmente a `/dashboard` tras registrarse, sin completar el
  pago, no es bloqueado a nivel de API. El acceso a datos sensibles
  (descuentos, RN03) sigue protegido server-side de todas formas, pero
  la experiencia de "member sin plan viendo su dashboard" es
  técnicamente alcanzable evitando el flujo de UI. Aceptado como
  limitación conocida, no bloqueante para el alcance actual del
  proyecto.
- (-) El monto cobrado en este flujo (precio de cada plan) está
  definido como constante en el frontend (`CompletarMembresia.tsx`), no
  validado ni calculado por el backend — a diferencia del pricing de
  canchas, que sí usa el patrón Strategy server-side. Es una asimetría
  de diseño documentada como deuda técnica, no una decisión deliberada
  de paridad con el resto del sistema de pricing.

## Cumplimiento

Verificable en `client/src/modules/usuarios/pages/RegistroPage.tsx`
(redirección condicional por `tipoActor` tras el registro),
`client/src/modules/membresias/pages/CompletarMembresia.tsx`, y
`server/src/membresias/membresias.controller.ts` (método `create` sin
`@Roles`, con `assertOwnerOrStaff`).

## Notas

Pendiente como mejora futura: mover los precios de los planes de
membresía al backend (tabla o configuración), y validar server-side el
monto recibido en `POST /pagos/pasarela` contra el precio real del plan
asociado — cerraría la asimetría señalada arriba y sería consistente
con cómo ya se resolvió el pricing de canchas (RF11, patrón Strategy).
