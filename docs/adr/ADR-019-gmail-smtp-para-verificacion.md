# ADR-019 — Verificación de email con Gmail SMTP, en vez de Resend o Auth0

- **Estado:** Reemplazado por ADR-021
- **Fecha:** 2026-09-30
- **Autor:** Zanandrea, Martín
- **Sprint:** 4

## Contexto

La verificación de email obligatoria al registrarse (ver contexto completo en la versión anterior de este ADR: se descartó migrar a Auth0 por el costo de reemplazar el sistema de autenticación ya construido y documentado en el ADR-014). La primera implementación usó Resend como proveedor de email transaccional, pero su plan gratuito solo permite enviar a la casilla propia del dueño de la cuenta mientras no se verifique un dominio propio — y el proyecto no tiene un dominio propio (vercel.app y onrender.com son subdominios de terceros, sin DNS propio editable).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Gmail SMTP con contraseña de aplicación** | Envía a cualquier destinatario sin dominio propio | Límite de envíos; no apto para producción a escala | Elegida en su momento |
| Resend | Proveedor transaccional dedicado | El plan gratuito solo envía al dueño sin dominio verificado | Sin dominio propio |
| Auth0 | Verificación de email incluida | Reemplazar la autenticación ya construida | Costo de migración |

## Decisión

Se reemplaza Resend por Gmail SMTP, usando una cuenta de Gmail creada específicamente para el proyecto (fitzonesports@gmail.com) con una contraseña de aplicación (no la contraseña real de la cuenta). Gmail SMTP permite enviar a cualquier destinatario real sin restricción de dominio verificado, dentro de un límite de aproximadamente 500 envíos diarios — suficiente para el volumen de un proyecto académico. El mecanismo de token de verificación (JWT con tipo 'email-verificacion', expiración 24hs) y el bloqueo de login hasta verificar se mantienen sin cambios; solo cambia el transporte de envío.

## Consecuencias

- **Positivas:** flujo de verificación probado con destinatarios reales.
- **Negativas:** Render bloquea el SMTP saliente: no funciona en producción.
- **Deuda asumida:** reemplazado por el proveedor abstracto del ADR-021.

## Requisitos relacionados

RF-01

## Detalle de las consecuencias

Se pierde la infraestructura dedicada de email transaccional de Resend (métricas de entrega, reputación de IP separada), a cambio de poder probar el flujo completo con destinatarios reales sin restricción. El límite de envíos de Gmail es generoso para el contexto académico, pero no sería apto para un uso productivo real a escala — si el proyecto creciera más allá de la cátedra, volver a un proveedor dedicado (con dominio propio verificado) sería la decisión correcta.

> Originalmente ADR 0010. Se conserva como registro histórico.
