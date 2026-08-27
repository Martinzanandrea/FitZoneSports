# ADR 0004: Cookie httpOnly para el almacenamiento del JWT

## Estado

Aceptado

## Contexto

El sistema autentica a los cuatro tipos de actor (Socio, Externo, Recepcionista, Gerente) mediante JWT. Existían dos alternativas para que el cliente (frontend web/móvil) conserve el token entre requests: almacenarlo en `localStorage` y enviarlo manualmente en el header `Authorization`, o que el backend lo entregue como cookie `httpOnly` y el navegador lo adjunte automáticamente en cada request.

`localStorage` es accesible desde cualquier script que corra en la página, incluyendo scripts inyectados por un ataque XSS — un JWT robado de esa forma permite suplantar la sesión del usuario sin más obstáculos.

## Decisión

Vamos a usar una cookie httpOnly para transportar el JWT, seteada por el backend en el login (`Set-Cookie`) y enviada automáticamente por el navegador en cada request al mismo dominio, con los atributos `httpOnly`, `secure` (en producción) y `sameSite: lax`.

## Consecuencias

Así el JWT nunca queda accesible desde JavaScript del lado del cliente, mitigando el robo de sesión vía XSS, y el cliente no necesita gestionar manualmente el almacenamiento ni el adjunto del token en cada request. Como contrapartida requiere configuración adicional de CORS (`credentials: true`) en backend y frontend y del atributo `trust proxy` cuando se despliega detrás de un proxy HTTPS (Render), y el flujo queda atado al esquema de cookies del mismo dominio, lo que exigirá planificación adicional si el cliente móvil nativo (fuera del navegador) necesita autenticarse, dado que esos clientes no gestionan cookies igual. La implementación es verificable en `AuthController.login()` con `res.cookie('token', ..., { httpOnly: true, secure, sameSite: 'lax' })` y en `JwtStrategy` que extrae el token exclusivamente de la cookie y no del header `Authorization`. Si se implementa la app móvil nativa mencionada en el documento base (C4: "App Móvil Socio"), habrá que evaluar un esquema complementario (por ejemplo, JWT en header `Authorization` para consumidores no-browser) en un ADR posterior.
