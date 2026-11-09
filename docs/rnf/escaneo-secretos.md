# Escaneo de secretos en el historial completo

**Fecha:** 2026-11-09 · **Alcance:** las 112 versiones de todas las ramas (`git log --all -p`), no solo el estado actual.

Condición de admisibilidad: *no hay credenciales, claves ni tokens reales en el repositorio; solo `.env.example`*.

## Método

Se recorrió cada línea agregada en cada commit buscando estos patrones:

| Patrón | Qué detecta |
|---|---|
| `eyJ….….…` | JWT, incluidas las claves `anon` y `service_role` de Supabase |
| `postgres://usuario:clave@` | Cadenas de conexión con contraseña |
| `xkeysib-[hex]` | Claves de API de Brevo |
| `AKIA…`, `ghp_…`, `AIza…`, `sk_live…`, `APP_USR-…` | AWS, GitHub, Google, Stripe, Mercado Pago |
| `-----BEGIN … PRIVATE KEY-----` | Claves privadas (incluida la VAPID) |
| `xxxx xxxx xxxx xxxx` | Contraseñas de aplicación de Gmail |
| `[a-z0-9]{20}.supabase.co` | Identificador del proyecto de Supabase |
| `*_SECRET`, `*_PASSWORD`, `*_API_KEY`, `*_TOKEN` con valor literal | Asignaciones de secretos en código o configuración |

Además se listaron todos los archivos `.env*` que se agregaron alguna vez al historial.

## Resultado

**Sin secretos reales.** Ningún archivo `.env` se versionó nunca (solo `server/.env.example` y `client/.env.example`, sin valores) y no aparece ninguna clave, token ni cadena de conexión real.

Coincidencias revisadas una por una, todas falsos positivos:

| Archivo | Qué es |
|---|---|
| `server/src/common/mail/brevo.enviador.spec.ts` | Constante `API_KEY` de prueba con el texto `xkeysib-clave-super-secreta-…`: no es hexadecimal ni tiene el formato de una clave de Brevo. |
| `server/src/acceso/acceso.service.spec.ts`, `crear-enviador.spec.ts`, `email-verificacion.service.spec.ts`, `usuarios-duplicados.spec.ts`, `seguridad-lecturas.spec.ts` | Valores de prueba (`'secreto-solo-para-pruebas'`, `'clave-secreta'`, `'p'`, `'123…'`). |
| `.github/workflows/ci.yml` | Contraseña del Postgres efímero del job de integración, que solo existe durante la corrida. |
| `client/src/…/CrearStaff.tsx`, `VerificarEmail.tsx`, `ControlAcceso.tsx` | Nombres de campos (`password: form.password`, `qrToken`), no valores. |
| `server/README.md` | Enlace de una imagen de la plantilla de NestJS. |
| `docker-compose.yml` | Valores por defecto solo de desarrollo local (`fitzone-local`, `solo-para-desarrollo-local-cambiar`), reemplazables con `.env`. |
| `server/db/seed/datos-prueba.sql` | Hash bcrypt de la contraseña de los usuarios de prueba, documentada en el README. |

## Prevención

- `.env` está en los `.gitignore` de `server/` y `client/`, y en los `.dockerignore`.
- El job `secretos` del CI corre [gitleaks](https://github.com/gitleaks/gitleaks) sobre todo el historial en cada push y pull request; si encuentra algo, el pipeline falla.
- Si alguna vez se versiona una clave real, borrarla del archivo no alcanza: hay que **rotarla** en el proveedor (Supabase, Brevo, Gmail) porque queda en el historial.
