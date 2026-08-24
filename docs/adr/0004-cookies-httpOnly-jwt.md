# ADR 0004: Cookie httpOnly para el almacenamiento del JWT

## Estado

Aceptada

## Contexto

El sistema autentica a los cuatro tipos de actor (Socio, Externo,
Recepcionista, Gerente) mediante JWT. Existían dos alternativas para que
el cliente (frontend web/móvil) conserve el token entre requests:
almacenarlo en `localStorage` y enviarlo manualmente en el header
`Authorization`, o que el backend lo entregue como cookie `httpOnly` y el
navegador lo adjunte automáticamente en cada request.

`localStorage` es accesible desde cualquier script que corra en la
página, incluyendo scripts inyectados por un ataque XSS — un JWT robado
de esa forma permite suplantar la sesión del usuario sin más obstáculos.

## Decisión

Utilizaremos una **cookie httpOnly** para transportar el JWT, seteada
por el backend en el login (`Set-Cookie`) y enviada automáticamente por
el navegador en cada request al mismo dominio, con los atributos
`httpOnly`, `secure` (en producción) y `sameSite: lax`.

## Consecuencias

- (+) El JWT nunca es accesible desde JavaScript del lado del cliente,
  mitigando el vector de robo de sesión vía XSS.
- (+) El cliente no necesita gestionar manualmente el almacenamiento ni
  el adjunto del token en cada request.
- (-) Requiere configuración adicional de CORS (`credentials: true`) en
  backend y frontend, y del atributo `trust proxy` en el servidor cuando
  se despliega detrás de un proxy HTTPS (Render).
- (-) El flujo de autenticación queda atado al mismo esquema de dominio/
  cookies, lo que exige planificación adicional si en el futuro el
  cliente móvil nativo (fuera del navegador) necesita autenticarse
  (los clientes no-browser no gestionan cookies de la misma forma).

## Cumplimiento

Verificable en `AuthController.login()`: uso de `res.cookie('token', ...,
{ httpOnly: true, secure, sameSite: 'lax' })`. La estrategia
`JwtStrategy` extrae el token exclusivamente de la cookie, no del header
`Authorization`.

## Notas

Si se implementa la app móvil nativa mencionada en el documento base del
proyecto (C4: "App Móvil Socio"), se deberá evaluar un esquema de
autenticación complementario para ese cliente (por ejemplo, JWT en
header `Authorization` para consumidores no-browser), documentado en un
ADR posterior.
