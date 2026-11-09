# Diagramas

Cada diagrama tiene su **fuente editable** en Mermaid (`.mmd`, texto plano versionable) y su **exportación** en SVG (vectorial) y PNG. El autor, la fecha y la versión figuran en el encabezado de cada fuente y en esta tabla.

Para editar: abrir el `.mmd` en [mermaid.live](https://mermaid.live) o en VS Code con la extensión *Markdown Preview Mermaid Support*, y volver a exportar SVG y PNG con el mismo nombre.

| Diagrama | Fuente | Exportación | Autor | Fecha | Versión |
|---|---|---|---|---|---|
| C4-1 Contexto | [c4-1-contexto.mmd](c4-1-contexto.mmd) | [SVG](c4-1-contexto.svg) · [PNG](c4-1-contexto.png) | Retamoso, Máximo | 2026-11-09 | 2.0 |
| C4-2 Contenedores | [c4-2-contenedores.mmd](c4-2-contenedores.mmd) | [SVG](c4-2-contenedores.svg) · [PNG](c4-2-contenedores.png) | Retamoso, Máximo | 2026-11-09 | 2.0 |
| C4-3 Componentes — Canchas (M4) | [c4-3-componentes-canchas.mmd](c4-3-componentes-canchas.mmd) | [SVG](c4-3-componentes-canchas.svg) · [PNG](c4-3-componentes-canchas.png) | Retamoso, Máximo | 2026-11-09 | 1.0 |
| C4-3 Componentes — Acceso (M2) | [c4-3-componentes-acceso.mmd](c4-3-componentes-acceso.mmd) | [SVG](c4-3-componentes-acceso.svg) · [PNG](c4-3-componentes-acceso.png) | Retamoso, Máximo | 2026-11-09 | 1.0 |
| DER físico | [der-fisico.mmd](der-fisico.mmd) | [SVG](der-fisico.svg) · [PNG](der-fisico.png) | Retamoso, Máximo | 2026-11-09 | 1.0 |
| Despliegue | [despliegue.mmd](despliegue.mmd) | [SVG](despliegue.svg) · [PNG](despliegue.png) | Retamoso, Máximo | 2026-11-09 | 1.0 |
| Arquitectura del pipeline | [pipeline.mmd](pipeline.mmd) | [SVG](pipeline.svg) · [PNG](pipeline.png) | Retamoso, Máximo | 2026-11-09 | 1.0 |

Las versiones 1.0 de los diagramas C4 de contexto, contenedores y componentes (draw.io, septiembre de 2026) siguen en [`docs/C4/`](../C4/) como registro histórico.

## Notas de lectura

- **DER físico:** generado desde la base que crean las migraciones `001` a `011` (`server/db/migrar.js`), así que coincide con el esquema real. PK, FK y UK van como marca del atributo; los índices y restricciones se anotan como comentario. Las que sostienen las reglas de negocio:
  - `uq_cancha_horario_confirmado` en `reservas_cancha (cancha_id, fecha, hora_inicio) WHERE estado = 'CONFIRMADA'`: impide la sobreventa (RN-02).
  - `uq_acceso_abierto_por_usuario` en `control_acceso (usuario_id) WHERE hora_egreso IS NULL`: un socio no puede estar en dos sedes (RN-01).
  - `excl_membresia_sin_superposicion` (EXCLUDE GiST) en `membresias`: sin períodos superpuestos.
  - `idx_reservas_cancha_disponibilidad (cancha_id, fecha, hora_inicio)`: consulta de disponibilidad (RNF-03).
- **Elementos "propuesto":** el camino offline del QR (copia local, cola y sincronización) aparece en el C4 de Acceso, en contenedores y en despliegue tal como lo describen ADR-003 y ADR-007, marcado como propuesto porque todavía no está implementado.

## Pendientes respecto de los lineamientos (5.3)

Faltan los diagramas UML: clases del dominio, secuencia de reserva con pago, secuencia de reserva concurrente, secuencia de validación offline, estados de membresía, estados de reserva y actividad de lista de espera.
