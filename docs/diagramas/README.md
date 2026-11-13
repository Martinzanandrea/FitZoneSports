# Diagramas de FitZone Sports

Cada vista tiene una fuente Mermaid editable y su exportación en SVG. El SVG conserva la nitidez al ampliar y se abre en cualquier navegador. El encabezado de la fuente identifica al autor (según el historial de git), la fecha y la versión.

Para ver el recorrido del QR sin conexión, empezá por el C4 de Acceso y seguí con la secuencia. El C4 muestra dónde viven los componentes. La secuencia muestra la preparación con red, el ingreso local y la conciliación al reconectar.

## Arquitectura

| Vista | Fuente | Exportación |
|---|---|---|
| C4-1 · Contexto | [Mermaid](c4-1-contexto.mmd) | [SVG](c4-1-contexto.svg) |
| C4-2 · Contenedores | [Mermaid](c4-2-contenedores.mmd) | [SVG](c4-2-contenedores.svg) |
| C4-3 · Canchas | [Mermaid](c4-3-componentes-canchas.mmd) | [SVG](c4-3-componentes-canchas.svg) |
| C4-3 · Acceso | [Mermaid](c4-3-componentes-acceso.mmd) | [SVG](c4-3-componentes-acceso.svg) |
| Despliegue | [Mermaid](despliegue.mmd) | [SVG](despliegue.svg) |
| Pipeline de integración | [Mermaid](pipeline.mmd) | [SVG](pipeline.svg) |

## Modelo físico

| Vista | Fuente | Exportación |
|---|---|---|
| DER · Mapa general | [Mermaid](der-fisico.mmd) | [SVG](der-fisico.svg) |
| Sedes, socios y acceso | [Mermaid](der-acceso.mmd) | [SVG](der-acceso.svg) |
| Canchas y pagos | [Mermaid](der-canchas-pagos.mmd) | [SVG](der-canchas-pagos.svg) |
| Clases y reservas | [Mermaid](der-clases.mmd) | [SVG](der-clases.svg) |
| Auditoría y avisos | [Mermaid](der-auditoria-avisos.mmd) | [SVG](der-auditoria-avisos.svg) |

## UML

| Vista | Fuente | Exportación |
|---|---|---|
| Clases del dominio | [Mermaid](uml-clases-dominio.mmd) | [SVG](uml-clases-dominio.svg) |
| Secuencia · Reserva y pago | [Mermaid](uml-secuencia-reserva-pago.mmd) | [SVG](uml-secuencia-reserva-pago.svg) |
| Secuencia · Reserva concurrente (RN-02) | [Mermaid](uml-secuencia-reserva-concurrente.mmd) | [SVG](uml-secuencia-reserva-concurrente.svg) |
| Secuencia · QR offline (RNF-01) | [Mermaid](uml-secuencia-acceso-offline.mmd) | [SVG](uml-secuencia-acceso-offline.svg) |
| Estados · Membresía | [Mermaid](uml-estados-membresia.mmd) | [SVG](uml-estados-membresia.svg) |
| Estados · Reserva | [Mermaid](uml-estados-reserva.mmd) | [SVG](uml-estados-reserva.svg) |
| Actividad · Lista de espera | [Mermaid](uml-actividad-lista-espera.mmd) | [SVG](uml-actividad-lista-espera.svg) |

## Correspondencia con el código

- **Canchas.** El controlador es `ReservasCanchaController`. `ReservasCanchaService` delega el precio a `PricingCalculatorService` y la reserva a `IBookingCanchaRepository`. `CanchasService` gestiona los bloqueos de la cancha.
- **Acceso.** `ClavesQrService` prepara las claves ES256. El terminal verifica el QR con `verificarQr.ts` y guarda los pendientes con `colaIngresos.ts`. Al reconectar, `AccesoService` concilia el lote. El diagrama asume una clave ES256 configurada y un snapshot vigente.
- **DER físico.** El mapa general sirve como índice. Las cuatro vistas de detalle conservan campos, claves e índices y muestran el evento agregado por la migración 012. Las tablas de referencia se repiten con su clave cuando una relación cruza de vista.
- **Concurrencia.** `uq_cancha_horario_confirmado` protege el turno confirmado (RN-02). `uq_acceso_abierto_por_usuario` protege la sesión única (RN-01). `uq_evento_offline_jti` detecta QR repetidos en la conciliación.
- **Estados de reserva.** El flujo de cancha persiste `CONFIRMADA` o `CANCELADA`. El pago se modela aparte. El código no tiene estados persistidos de cancha «pendiente de pago» o «cumplida» ni aplica penalidad en esa cancelación. La reserva de clase sí tiene lista de espera y una restricción horaria para la cancelación del socio.

Las fuentes se pueden abrir en [Mermaid Live](https://mermaid.live). Las exportaciones de esta revisión se generaron con Mermaid 11.12.0. Las versiones anteriores de los C4 en draw.io están en [docs/C4](../C4/).
