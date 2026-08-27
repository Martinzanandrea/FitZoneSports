# ADR 0010: Doble punto de entrada de autenticación (cliente vs. staff)

## Estado

Aceptada

## Contexto

El sistema tiene cuatro tipos de actor autenticables (Socio, Externo,
Recepcionista, Gerente) compartiendo el mismo mecanismo de login
(email + password, JWT en cookie httpOnly). Inicialmente se usaba un
único formulario de login (`/login`) para los cuatro roles. Esto
generaba dos problemas de UX y organización: (1) un cliente no tenía
forma de encontrar el acceso administrativo sin conocer de antemano la
URL `/admin`, y (2) no había ninguna señal visual ni funcional que
distinguiera "esta puerta es para clientes" de "esta puerta es para
personal interno", pese a que las áreas de la aplicación resultantes
(`/dashboard` vs `/admin/*`) son completamente distintas en propósito y
permisos.

## Decisión

Utilizaremos **dos rutas de login separadas** con el mismo componente
visual reutilizado (`Login.tsx`, parametrizado por una prop `audience:
'cliente' | 'staff'`): `/login` para Socio/Externo y `/admin/login` para
Recepcionista/Gerente. Cada una valida, tras una autenticación exitosa,
que el `tipoActor` del usuario corresponda a la audiencia de esa puerta
— si no corresponde, se cierra la sesión recién abierta y se informa
que debe usar el otro acceso. `ProtectedRoute` acepta un `loginPath`
configurable para redirigir siempre a la puerta correcta según el área
protegida en la que ocurrió el intento de acceso no autenticado.

## Consecuencias

- (+) Un visitante de cualquiera de las dos puertas nunca ve un
  formulario que no le corresponde ni credenciales que no puede usar
  ahí, reduciendo confusión.
- (+) Reutilización real de componente (mismo diseño, mismo código base)
  en lugar de duplicar el formulario — el único costo es la validación
  de audiencia y las props de configuración.
- (+) El interceptor de Axios (401 global) y el `ProtectedRoute`
  redirigen siempre a la puerta correcta según la ruta en la que ocurrió
  el fallo (`/admin/*` → `/admin/login`, resto → `/login`), evitando el
  loop de redirección cruzada detectado durante el desarrollo.
- (-) La validación de audiencia ocurre después de una autenticación ya
  exitosa contra el backend (el backend no distingue "puertas", solo
  roles) — es una capa de UX, no de seguridad adicional: el control de
  acceso real sigue siendo el `RolesGuard` del backend en cada endpoint,
  no la elección de formulario de login.

## Cumplimiento

Verificable en `client/src/modules/auth/pages/Login.tsx` (prop
`audience`, arrays `ROLES_STAFF`/`ROLES_CLIENTE`), y en
`client/src/routes/AppRoutes.tsx` (dos `<Route>` de login, `loginPath`
distinto en cada `ProtectedRoute`).

## Notas

Se agregó un link cruzado discreto ("Operarios y administradores →") en
`/login` hacia `/admin/login`, para que el personal que desconozca la
URL directa pueda encontrarla sin salir de la aplicación.
