# ADR 0010: Verificación de email con Gmail SMTP, en vez de Resend o Auth0

## Estado
Aceptado (reemplaza la decisión anterior documentada en este mismo ADR, que usaba Resend)

## Contexto
La verificación de email obligatoria al registrarse (ver contexto completo en la versión anterior de este ADR: se descartó migrar a Auth0 por el costo de reemplazar el sistema de autenticación ya construido y documentado en el ADR 0005). La primera implementación usó Resend como proveedor de email transaccional, pero su plan gratuito solo permite enviar a la casilla propia del dueño de la cuenta mientras no se verifique un dominio propio — y el proyecto no tiene un dominio propio (vercel.app y onrender.com son subdominios de terceros, sin DNS propio editable).

## Decisión
Se reemplaza Resend por Gmail SMTP, usando una cuenta de Gmail creada específicamente para el proyecto (fitzonesports@gmail.com) con una contraseña de aplicación (no la contraseña real de la cuenta). Gmail SMTP permite enviar a cualquier destinatario real sin restricción de dominio verificado, dentro de un límite de aproximadamente 500 envíos diarios — suficiente para el volumen de un proyecto académico. El mecanismo de token de verificación (JWT con tipo 'email-verificacion', expiración 24hs) y el bloqueo de login hasta verificar se mantienen sin cambios; solo cambia el transporte de envío.

## Consecuencias
Se pierde la infraestructura dedicada de email transaccional de Resend (métricas de entrega, reputación de IP separada), a cambio de poder probar el flujo completo con destinatarios reales sin restricción. El límite de envíos de Gmail es generoso para el contexto académico, pero no sería apto para un uso productivo real a escala — si el proyecto creciera más allá de la cátedra, volver a un proveedor dedicado (con dominio propio verificado) sería la decisión correcta.
