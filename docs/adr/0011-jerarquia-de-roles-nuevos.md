# ADR 0011: Jerarquía de roles de gestión — Gerente General y Gerente de Sede

## Estado

Aceptada

## Contexto

El enunciado agregó un rol de gerente general que administra gerentes
de sede: una persona con visibilidad total sobre todas las sedes, y
gerentes operativos acotados a su propia sede. El rol GERENTE anterior
era plano (acceso total sin sede) y no distinguía niveles.

## Decisión

Se divide el rol en tres niveles con scope por exclusión (fail-closed):
si el actor no es GERENTE_GENERAL, se acota a su sedeId; sin sedeId se
rechaza con 403. El scope se aplica también en el WHERE de listados y
reportes, no solo en endpoints por id.

- GERENTE_GENERAL: ve y administra todas las sedes. Es el único que
  edita precios de planes de membresía, crea o elimina sedes,
  administra el catálogo de tipos de cancha, crea y gestiona gerentes
  de sede, activa o desactiva instructores y ejecuta marcar-vencidas.
- GERENTE_SEDE: administra todo lo de su sede salvo los precios de
  planes. Crea y edita canchas (incluido costoHoraBase), las pone en
  mantenimiento y las elimina físicamente solo si no tienen reservas
  en ningún estado; gestiona clases, instructores (alta y edición),
  membresías, accesos, pagos, franjas horarias, alta y baja de
  recepcionistas de su sede y reportes limitados a su sede.
- RECEPCIONISTA: opera en una sede. Ve aforo y quién está dentro,
  valida QR y código de 6 dígitos y registra egreso, cobra en efectivo
  (plan de membresía o reserva de cancha, no clases), anota socios a
  clases y canchas, ve el estado de membresía en solo lectura y un
  panel liviano sin dinero.
- Excepción documentada: las canchas admiten borrado físico
  condicionado (0 reservas), a diferencia del resto de las entidades
  que se dan de baja lógicamente, para corregir errores de carga.

## Consecuencias

El control de acceso por dueño o staff se acotó: el acceso a perfiles
y membresías de otros usuarios depende del rol y de la sede, y el socio
que reserva para sí mismo conserva el uso multi-sede.
Un pago de membresía APROBADO (pasarela o efectivo del staff) convierte al
titular EXTERNO en SOCIO, en la misma transacción que el pago (única función:
`PagosService.promoverExternoASocioSiCorresponde`). El rol del titular es el
único que cambia; ningún otro rol se toca. Un pago rechazado no lo cambia.
El valor GERENTE del enum se conserva por compatibilidad en Postgres
y los usuarios existentes se migraron a GERENTE_GENERAL (migración 005).
