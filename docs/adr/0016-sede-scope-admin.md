# ADR 0016: Scoping por sede en AdminService

## Estado

Aceptado

## Contexto

El módulo `AdminModule`, agregado para dar soporte al dashboard
gerencial (resumen de clases/canchas del día, listado consolidado de
reservas), consultaba todas las sedes sin ningún filtro, a diferencia
del resto de los módulos del backend (`clases`, `canchas`, `acceso`,
`pagos`), que ya aplican `assertSedeScope` para que un `RECEPCIONISTA`
solo opere sobre su propia sede. Los dos endpoints del módulo estaban
restringidos a `GERENTE` (rol exento de scoping por diseño), por lo que
el problema no era explotable en su forma original — pero el service
en sí quedaba inseguro por construcción: cualquier ampliación futura de
`@Roles` para incluir `RECEPCIONISTA` habría expuesto datos de todas
las sedes sin ninguna barrera adicional.

## Decisión

Vamos a aplicar el mismo patrón de sede-scope ya usado en el resto del
backend a `AdminService`: los métodos reciben el usuario autenticado y
filtran por `sede.id` cuando quien consulta es `RECEPCIONISTA`, sin
filtro cuando es `GERENTE`. De paso, ampliamos `@Roles` de ambos
endpoints para incluir `RECEPCIONISTA`, ahora que el filtrado lo
sostiene de forma segura.

## Consecuencias

Cierra el riesgo latente antes de que se activara — el service ya no
depende únicamente de qué rol tenga acceso al endpoint para estar
protegido, sino que filtra explícitamente igual que el resto del
backend. Como beneficio adicional, el Recepcionista gana visibilidad
real sobre el resumen y las reservas de su propia sede, algo que antes
no tenía. Queda pendiente, como mejora de mantenibilidad no urgente,
que `AdminService` reutilice los métodos ya existentes de
`ClasesService`/`CanchasService` en lugar de reconsultar las mismas
entidades con queries propias — hoy funciona correctamente pero duplica
lógica que ya vive en esos services.
