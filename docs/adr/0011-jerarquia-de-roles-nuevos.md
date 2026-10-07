# ADR 0011: Jerarquía de roles de gestión — Gerente General y Gerente de Sede

## Estado

Aceptado

## Contexto

El enunciado original del TP no contemplaba una cadena con múltiples
sedes gestionadas por personas distintas — el rol GERENTE actual
asumía una sola persona con visibilidad total sobre todas las sedes.
El profesor incorporó un requisito no contemplado originalmente: cada
sede puede tener su propio gerente operativo, con un rol superior
(Gerente General) que administra la red completa y designa a los
gerentes de cada sede.

## Decisión

Se divide el rol GERENTE en dos: GERENTE_GENERAL (capacidades de red
completa: crear/eliminar sedes, catálogo global de tipos de cancha,
precios de planes de membresía, marcar membresías vencidas en lote,
alta/baja de Gerentes de Sede, reportes consolidados de toda la
cadena) y GERENTE_SEDE (capacidades operativas idénticas al Gerente
actual, pero con el mismo mecanismo de scope por sede que ya usa
RECEPCIONISTA: gestión de canchas/clases/instructores/membresías/
accesos/pagos de su propia sede, alta/baja de Recepcionistas de su
sede, y reportes financiero/membresías/auditoría limitados a su
sede). RECEPCIONISTA no cambia.

El mecanismo técnico central es assertSedeScope: GERENTE_SEDE pasa a
tratarse exactamente igual que RECEPCIONISTA en ese helper (compara
sedeId contra la sede objetivo), mientras que GERENTE_GENERAL
conserva el bypass total que hoy tiene GERENTE. Esto activa el scope
automáticamente en los 8 lugares que ya llaman al helper, sin
duplicar lógica de autorización.

## Consecuencias

El criterio de qué queda "de red" vs "de sede" se decidió recurso por
recurso: el catálogo de tipos de cancha y los precios de planes
quedan exclusivos de GERENTE_GENERAL porque son compartidos por toda
la cadena — un cambio ahí afecta sedes que el Gerente de Sede no
administra. Crear o eliminar sedes, y designar Gerentes de Sede,
quedan como decisiones de red por la misma razón. Todo lo demás que
ya tenía family de sede-scope (membresías, accesos, pagos) extiende
naturalmente su alcance a GERENTE_SEDE sin cambios de lógica, solo de
autorización. El costo real no está en agregar el enum a cada lista
de @Roles (mecánico), sino en decidir caso por caso qué nivel
corresponde — este ADR documenta esas decisiones para no tener que
re-auditarlas más adelante.
