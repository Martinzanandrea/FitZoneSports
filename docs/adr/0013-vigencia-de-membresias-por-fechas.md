# ADR 0013: Vigencia de membresías por fechas y no superposición

## Estado

Aceptada (implementación de backend; la migración 010 y el cliente quedan pendientes)

## Contexto

Comprar o renovar con otra membresía vigente creaba una fila ACTIVO más, sin
cerrar la anterior ni impedir períodos superpuestos. Casi todos los lugares que
leían la membresía (QR, reservas de clases, precio de canchas, reportes,
listados) elegían por `estado = ACTIVO`, sin mirar fechas, y `renovar()` tomaba
"la primera" ACTIVO sin orden. Además las fechas se calculaban con
`toISOString()` (UTC; después de las 21:00 argentinas el inicio caía "mañana"),
`setMonth` desbordaba (31/01 + 1 mes = 03/03) y la vigencia dependía del cron
nocturno, que puede no ejecutarse en el hosting gratuito. No había restricción
en la base, y dos compras simultáneas podían duplicar períodos.

## Decisión

Alternativa A del análisis: cada compra crea su propia fila (con su propio pago)
y la vigencia se decide siempre por fechas.

1. `fecha_fin` es **exclusiva**: el primer día en que la membresía ya no vale.
   Vigente hoy = `estado = ACTIVO` y `fecha_inicio <= hoy < fecha_fin`, con
   "hoy" en hora de Argentina (`ahoraArgentina()`). Próxima = ACTIVO con
   `fecha_inicio > hoy`.
2. Una compra con una membresía vigente o en cola no pisa nada: la nueva empieza
   en el **mayor `fecha_fin`** entre las ACTIVO que no terminaron, o hoy si no
   hay ninguna. Se permite un plan distinto.
3. Máximo una vigente y una próxima: con una próxima se rechaza con 409
   ("Ya tenés una membresía programada. Podrás comprar otra cuando comience"),
   antes de cobrar en la pasarela y de nuevo, con bloqueo, dentro de la
   transacción del alta.
4. `fecha_fin` suma meses de calendario recortando al último día del mes
   (31/01 + 1 = 28 o 29/02), en fechas argentinas.
5. Único módulo de decisión: `server/src/membresias/vigencia.ts` (`esVigente`,
   `esProxima`, `sumarMeses`, `obtenerVigente`, `obtenerProxima`,
   `obtenerCadena`). Los consumidores (QR, reserva de clases, precio de cancha,
   pagos, listado de clientes, reportes) usan solo estas funciones o el
   fragmento SQL equivalente.
6. Alta única (`MembresiasService.alta`): toma `SELECT ... FOR UPDATE` sobre la
   fila del usuario dentro de la transacción del pago, calcula inicio y fin y
   aplica el tope. `create()` y `renovar()` dejan de existir.
7. Defensa en la base (script `010`, a ejecutar a mano): restricción de
   exclusión GiST sobre `usuario_id` y `daterange(fecha_inicio, fecha_fin,
   '[)')`, para filas con estado distinto de SUSPENDIDO (requiere la extensión
   `btree_gist`). El error 23P01 se traduce a 409.
8. El cron pasa a marcar VENCIDO con `fecha_fin <= hoy` (hora argentina). Es
   solo higiene: la corrección del sistema **no depende** de que corra, y las
   respuestas informan VENCIDO para una ACTIVO ya terminada.
9. `PATCH /membresias/:id` ya no asigna campos libres: solo `renovacionAuto` y
   ACTIVO <-> SUSPENDIDO. Reactivar exige que no se superponga ni exceda una
   vigente más una próxima (409 si no).
10. `GET /membresias/vigente/:id` conserva sus campos, tomados de la vigente (o
    de la última no próxima si no hay vigente), y agrega `proxima` (objeto o
    null).

## Alternativas descartadas

- **B — estado nuevo (programada/pendiente) activado al llegar su fecha:**
  cambia el enum de la base y depende de un proceso que active la fila; con el
  cron potencialmente apagado el socio quedaría sin acceso. Terminaría
  recalculando por fechas igual, con más piezas.
- **C — rechazar la compra mientras haya una vigente (permitir renovar solo a
  pocos días del vencimiento):** simple, pero elimina la renovación anticipada
  que la interfaz ofrece, y sin restricción en la base sigue habiendo carrera
  entre dos requests.

## Consecuencias

- Con una vigente, una segunda compra legítima (o un doble clic que llega al
  servidor dos veces) queda como próxima y se cobra: la protección de doble
  clic sigue siendo la del cliente (botón deshabilitado); el servidor solo
  garantiza que no haya más de una próxima ni superposiciones.
- Los reportes pasan a contar membresías vigentes hoy; se agregan `programadas`
  y, por socio, `fechaInicio`, `vigente` y `proxima`. Los campos existentes se
  conservan, pero el valor de `estado` ahora informa VENCIDO para una ACTIVO
  terminada.
- El "vencimiento" del listado de clientes es la `fecha_fin` (exclusiva) de la
  vigente, o de la más reciente no próxima.
- Hay que correr 009, limpiar datos superpuestos y recién entonces 010.
- Pendiente en el cliente: mostrar vigente y próxima, y tratar `fecha_fin` como
  exclusiva en textos y cuenta de días.

## Limitación de las pruebas de concurrencia

Los tests usan repositorios simulados: verifican el orden (bloqueo antes de
calcular), la lógica de encadenado, el tope y la traducción de 23P01, pero **no
pueden probar** que el bloqueo de fila serialice dos transacciones reales ni
que la restricción de exclusión rechace una inserción concurrente. Eso exige
una base PostgreSQL real con dos conexiones simultáneas y `btree_gist`
habilitada; queda como prueba manual o de integración pendiente.
