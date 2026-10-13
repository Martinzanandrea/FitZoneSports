# ADR 0012: Envío de correo mediante proveedor abstracto (Brevo en producción, Gmail en desarrollo)

## Estado

Aceptado. Reemplaza al ADR 0010.

## Contexto

El ADR 0010 adoptó Gmail SMTP como transporte de correo para la verificación
de email. Esa decisión funcionó en desarrollo local, pero en producción el
backend corre en el plan gratuito de Render, que bloquea el SMTP saliente
(puertos 25, 465 y 587). El resultado fue un error ETIMEDOUT en todos los
envíos desde producción: tanto el mail de verificación de cuenta como las
notificaciones por correo. Gmail SMTP seguía funcionando solo en local.

Los dos consumidores del correo (`EmailVerificacionService` y
`EmailNotificador`) creaban o usaban directamente el transporte SMTP, de modo
que cambiar de proveedor implicaba modificarlos.

## Decisión

Se introduce la abstracción `EnviadorCorreo` (`server/src/common/mail/`), con
un único método `enviar({ para, asunto, html, texto? })`, y dos
implementaciones:

- `BrevoEnviador`: envía por la API HTTPS de Brevo (`POST
  https://api.brevo.com/v3/smtp/email`) usando `fetch` nativo de Node, con un
  timeout de 10 segundos mediante `AbortController`. No agrega dependencias.
- `GmailSmtpEnviador`: el envío por SMTP con nodemailer ya existente, movido
  sin cambios funcionales y con las mismas variables `GMAIL_USER` y
  `GMAIL_APP_PASSWORD`. Se usa solo en desarrollo local.

La implementación activa se elige con la variable de entorno `MAIL_PROVIDER`
(`brevo` o `gmail`; si no está definida, `gmail`), mediante un provider de
NestJS con `useFactory`. La configuración se valida al arrancar: con `brevo`
son obligatorias `BREVO_API_KEY` y `MAIL_FROM_EMAIL` (`MAIL_FROM_NAME` es
opcional), y un valor desconocido de `MAIL_PROVIDER` impide iniciar el
servidor. Los mensajes de error nombran las variables pero nunca sus valores.

Los consumidores dependen de la interfaz y no de un proveedor concreto. Un
fallo de envío no interrumpe el flujo principal (registro de usuario,
notificación en el panel): se registra y, en las notificaciones, se cuenta
como envío fallido. Se mantiene la pausa de 300 ms entre envíos de un mismo
lote. Los logs registran solo el id de usuario, el status y el código del
error y, en un timeout, la duración; nunca la API key, el contenido del mail
ni la dirección completa del destinatario.

### Patrón de diseño

La abstracción aplica el principio de inversión de dependencias: los módulos
de alto nivel (verificación de cuenta, notificaciones) dependen de la
interfaz `EnviadorCorreo`, y las implementaciones de bajo nivel dependen de
ella, no al revés. Cambiar de proveedor se reduce a agregar una
implementación y registrarla en la fábrica, sin tocar los consumidores. Es
la misma lógica de desacople que ya usa el módulo de notificaciones con su
fábrica de notificadores por canal.

## Alternativas consideradas

- **Seguir con Gmail SMTP:** descartada, porque Render bloquea el SMTP
  saliente y no es posible enviar desde producción.
- **Otro proveedor con API HTTPS:** es viable en general, porque la API
  HTTPS no está afectada por el bloqueo de puertos. Con la abstracción
  adoptada, incorporarlo no exigiría cambios en los consumidores.
- **Gmail API con OAuth:** también usa HTTPS, pero requiere un flujo de
  autorización OAuth en lugar de una contraseña de aplicación. No se adoptó.
- **Dominio propio:** el proyecto no tiene uno (ver ADR 0010). Es la mejora
  pendiente para la entrega, descrita en las consecuencias.

## Consecuencias

- Los envíos de producción dependen de un proveedor externo y de los límites
  de su plan gratuito.
- El remitente es una dirección de Gmail verificada como remitente
  individual (sender) en Brevo. Al no ser un dominio propio, no se puede
  autenticar con DKIM ni DMARC propios, por lo que los mensajes pueden ser
  clasificados como spam. Para mejorar la entrega habría que usar un dominio
  propio.
- La API key de Brevo vive únicamente en las variables de entorno de Render
  (y en el `.env` local, que no se versiona). Se documentan los nombres de
  las variables en `server/.env.example`, sin valores.
- Gmail SMTP queda restringido a desarrollo local: en producción debe
  configurarse `MAIL_PROVIDER=brevo`.
- El envío por Brevo se verificó con pruebas unitarias con `fetch` simulado.
  No se probó el envío masivo con volumen real.
- Se mantiene lo ya decidido sobre el mecanismo de verificación (token JWT de
  tipo 'email-verificacion' con expiración de 24 horas y bloqueo de login
  hasta verificar): solo cambia el transporte.
