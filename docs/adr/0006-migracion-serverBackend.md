# ADR 0006: Migración del hosting de backend de Railway a Render

## Estado

Aceptada (sustituye la elección inicial de Railway)

## Contexto

El backend se desplegó inicialmente en Railway. Al momento de la
implementación, Railway había discontinuado su tier gratuito permanente,
ofreciendo únicamente un crédito de prueba de USD 5 válido por 30 días
para cuentas nuevas, tras lo cual el servicio requiere un plan pago
(Hobby, desde USD 5/mes con cobro por uso). Dado que el proyecto es de
carácter académico/personal, sin presupuesto asignado, se evaluó migrar
a Render, que ofrece un tier gratuito permanente para servicios web.

## Decisión

Utilizaremos **Render** (plan Free) como plataforma de despliegue del
backend, aceptando la limitación de que el servicio entra en estado de
suspensión ("sleep") tras 15 minutos sin tráfico, con una demora de
30-50 segundos en la primera respuesta tras reactivarse.

## Consecuencias

- (+) Costo cero de hosting para el backend, sostenible durante todo el
  desarrollo y evaluación académica del proyecto.
- (+) El código no requirió modificaciones más allá de la lectura
  dinámica del puerto (`process.env.PORT`), ya compatible con ambos
  proveedores.
- (-) La primera request tras un período de inactividad tiene una
  latencia alta (30-50s), lo que puede percibirse como una falla si se
  prueba el sistema sin este contexto.
- (-) Sin garantía de disponibilidad continua (SLA), no apto si el
  proyecto pasara a producción con usuarios reales sin reevaluar el plan.

## Cumplimiento

Verificable en el dashboard de Render (servicio activo, plan Free) y en
`server/src/main.ts`, línea `await app.listen(process.env.PORT ?? 3000)`.

## Notas

Si el proyecto avanza más allá del ámbito académico (usuarios reales,
expectativa de disponibilidad constante), se debe reevaluar esta
decisión.
