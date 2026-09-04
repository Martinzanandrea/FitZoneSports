# ADR 0006: Migración del hosting de backend de Railway a Render

## Estado

Aceptado

## Contexto

El backend se desplegó inicialmente en Railway. Al momento de la implementación, Railway había discontinuado su tier gratuito permanente, ofreciendo únicamente un crédito de prueba de USD 5 válido por 30 días para cuentas nuevas, tras lo cual el servicio requiere un plan pago (Hobby, desde USD 5/mes con cobro por uso). Dado que el proyecto es de carácter académico/personal, sin presupuesto asignado, se evaluó migrar a Render, que ofrece un tier gratuito permanente para servicios web.

## Decisión

Vamos a usar Render (plan Free) como plataforma de despliegue del backend, aceptando la limitación de que el servicio entra en estado de suspensión ("sleep") tras 15 minutos sin tráfico, con una demora de 30-50 segundos en la primera respuesta tras reactivarse. Esta decisión sustituye la elección inicial de Railway.

## Consecuencias

Esto permite costo cero de hosting sostenible durante todo el desarrollo y la evaluación académica, y no requirió modificaciones de código más allá de la lectura dinámica del puerto (`process.env.PORT`), ya compatible con ambos proveedores. Como contrapartida, la primera request tras un período de inactividad sufre una latencia alta de 30-50s que puede percibirse como falla sin el contexto adecuado, y no hay garantía de disponibilidad continua (SLA), por lo que no es apto para producción con usuarios reales sin reevaluar el plan. El cumplimiento es verificable en el dashboard de Render (servicio activo, plan Free) y en `server/src/main.ts` con `await app.listen(process.env.PORT ?? 3000)`. Si el proyecto avanza más allá del ámbito académico con expectativa de disponibilidad constante, esta decisión deberá reevaluarse.
