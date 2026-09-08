# ADR 0005: Autenticación con JWT en cookie httpOnly y autorización por rol, dueño y sede

## Estado

Aceptado

## Contexto

El sistema autentica a cuatro tipos de actor (Socio, Externo, Recepcionista, Gerente) que comparten un único mecanismo de login pero requieren visibilidad y permisos distintos. Un cliente no tenía forma de encontrar el acceso administrativo mediante una única puerta de login. Un Recepcionista podía operar sobre sedes ajenas a la suya, porque el control de acceso solo filtraba por rol, no por pertenencia a sede. Y almacenar el token en localStorage habría expuesto la sesión a robo vía XSS.

## Decisión

Vamos a: (1) transportar el JWT en una cookie httpOnly —nunca en localStorage—, con el atributo secure en producción y sameSite lax; (2) separar dos rutas de login (/login para clientes, /admin/login para personal), reutilizando el mismo componente parametrizado por una prop de audiencia que valida que el rol corresponda a esa puerta; (3) aplicar un mecanismo de scoping por sede (assertSedeScope) en todos los módulos donde un Recepcionista puede operar —acceso, clases, canchas, pagos, y los reportes agregados del panel administrativo—, de modo que solo pueda actuar sobre la sede indicada en su propio registro de usuario, propagada a través del JWT.

## Consecuencias

El JWT nunca es accesible desde JavaScript del lado del cliente, mitigando el robo de sesión vía XSS. Ningún visitante ve un formulario de login que no le corresponde. Un Recepcionista no puede operar sobre otra sede aunque lo intente vía API directa, en ningún módulo del sistema. Como contrapartida, requiere configuración adicional de CORS y de trust proxy detrás del proveedor de hosting, y la validación de audiencia del login es una capa de experiencia de usuario: el control de seguridad real sigue siendo el guard de rol del backend en cada endpoint.

Nota de refuerzo: se detectó y corrigió que dos implementaciones del
scoping por sede (membresías, opciones de cobro en efectivo) fallaban
"abierto" ante un Recepcionista sin sedeId asignado (devolvían datos
de todas las sedes en vez de ninguna). Se ajustó el criterio a
fail-closed explícito en ambos casos, y se agregó una pantalla
dedicada en el frontend que bloquea a un Recepcionista sin sede antes
de que use cualquier pantalla del panel, mostrando ese estado como
transitorio y esperable, no como un error.
