# ADR 0014: Endpoints agregados para el panel gerencial

## Estado

Aceptada

## Contexto

El panel del gerente necesita mostrar información de distintos módulos:
clases, canchas, reservas y métricas generales.

Consultar cada módulo por separado desde el frontend aumentaría la cantidad
de solicitudes HTTP y repartiría la lógica de consolidación entre varios
componentes.

## Decisión

Se utilizarán endpoints administrativos agregados para devolver en una sola
respuesta la información necesaria para cada pantalla del gerente.

Ejemplos:

- `GET /admin/dashboard/resumen`
- `GET /admin/reservas`

Estos endpoints estarán protegidos para usuarios con rol `GERENTE`.
La consolidación y los cálculos se realizarán en el backend, mientras que el
frontend se encargará de mostrar y filtrar los resultados.

## Consecuencias

- Menos solicitudes desde el frontend.
- Cálculos centralizados en el backend.
- Respuestas adaptadas a las necesidades del panel gerencial.
- Los endpoints administrativos dependen de varias entidades y módulos.
- Los cambios en la respuesta requieren coordinar backend y frontend.

## Seguridad

El acceso estará protegido mediante `JwtAuthGuard`, `RolesGuard` y el rol
`GERENTE`.