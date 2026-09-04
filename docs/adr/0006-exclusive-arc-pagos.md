# ADR 0005: Exclusive arc (FKs nullables + CHECK) en lugar de FK polimórfica en `pagos`

## Estado

Aceptado

## Contexto

Un pago puede corresponder a exactamente una de tres cosas: una membresía, una reserva de clase, o una reserva de cancha. El modelado inicial usaba una FK polimórfica genérica (`tipo_referencia` + `referencia_id`), un patrón común por su rapidez de implementación. Sin embargo, Postgres no puede validar la existencia de la fila referenciada en un `referencia_id` genérico, ya que no sabe a qué tabla apunta en tiempo de definición del esquema — la integridad quedaría delegada enteramente a la capa de aplicación, sin respaldo de la base de datos.

Dado que `pagos` es una tabla sensible (maneja dinero real o simulado, y trazabilidad de cobros), se priorizó integridad sobre velocidad de desarrollo.

## Decisión

Vamos a usar el patrón exclusive arc: tres columnas de clave foránea nullables (`membresia_id`, `reserva_clase_id`, `reserva_cancha_id`), cada una con su propio `REFERENCES`, junto con un `CHECK` que exige que exactamente una de las tres esté presente en cada fila.

## Consecuencias

De esta forma Postgres valida la existencia real de la fila referenciada en los tres casos y rechaza cualquier `INSERT` que apunte a una membresía o reserva inexistente, mientras que el `CHECK chk_pago_referencia_unica` impide que un pago quede sin referencia o con más de una, y el tipo de pago se infiere de cuál columna está poblada (expuesto como getter `tipoReferencia` en la entidad) sin duplicar el dato. El costo es mantener tres columnas nullables en lugar de dos fijas y, si en el futuro aparece un cuarto tipo de referencia, habrá que agregar una columna y ajustar el `CHECK` en lugar de solo aceptar un nuevo valor de enum. El cumplimiento es verificable en `fitzone_schema.sql`, tabla `pagos`, con las tres columnas con `REFERENCES` individuales y el constraint `chk_pago_referencia_unica`, patrón que se replicó para distinguir pago por pasarela de pago en efectivo (`chk_pago_metodo_datos`: `token_pasarela` vs `registrado_por_id`).
