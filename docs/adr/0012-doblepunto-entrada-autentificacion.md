# ADR 0012: Doble punto de entrada de autenticación (cliente vs. staff)

## Estado

Aceptado

## Contexto

El sistema tiene cuatro tipos de actor autenticables (Socio, Externo, Recepcionista, Gerente) compartiendo el mismo mecanismo de login (email + password, JWT en cookie httpOnly). Inicialmente se usaba un único formulario de login (`/login`) para los cuatro roles. Esto generaba dos problemas de UX y organización: (1) un cliente no tenía forma de encontrar el acceso administrativo sin conocer de antemano la URL `/admin`, y (2) no había ninguna señal visual ni funcional que distinguiera "esta puerta es para clientes" de "esta puerta es para personal interno", pese a que las áreas de la aplicación resultantes (`/dashboard` vs `/admin/*`) son completamente distintas en propósito y permisos.

## Decisión

Vamos a usar dos rutas de login separadas con el mismo componente visual reutilizado (`Login.tsx`, parametrizado por una prop `audience: 'cliente' | 'staff'`): `/login` para Socio/Externo y `/admin/login` para Recepcionista/Gerente. Cada una valida, tras una autenticación exitosa, que el `tipoActor` del usuario corresponda a la audiencia de esa puerta —si no corresponde, se cierra la sesión recién abierta y se informa que debe usar el otro acceso— y `ProtectedRoute` acepta un `loginPath` configurable para redirigir siempre a la puerta correcta según el área protegida en la que ocurrió el intento de acceso no autenticado.

## Consecuencias

De este modo un visitante nunca ve un formulario que no le corresponde ni credenciales que no puede usar ahí, se reutiliza el mismo diseño y código base en lugar de duplicar el formulario con el único costo de la validación de audiencia y las props de configuración, y tanto el interceptor de Axios (401 global) como `ProtectedRoute` redirigen siempre a la puerta correcta según la ruta donde ocurrió el fallo (`/admin/*` → `/admin/login`, resto → `/login`) evitando el loop de redirección cruzada detectado durante el desarrollo. La contracara es que la validación de audiencia ocurre después de una autenticación ya exitosa contra el backend, que no distingue puertas y solo valida roles, por lo que es una capa de UX y no de seguridad adicional: el control real sigue siendo el `RolesGuard` del backend en cada endpoint. El cumplimiento es verificable en `client/src/modules/auth/pages/Login.tsx` con la prop `audience` y los arrays `ROLES_STAFF`/`ROLES_CLIENTE`, y en `client/src/routes/AppRoutes.tsx` con las dos rutas de login y el `loginPath` distinto en cada `ProtectedRoute`. Se agregó además un link cruzado discreto ("Operarios y administradores →") en `/login` hacia `/admin/login` para que el personal que desconozca la URL directa pueda encontrarla.
