-- 009-diagnostico-membresias-superpuestas.sql
-- DIAGNÓSTICO de solo lectura (solo SELECT): detecta usuarios con más de una
-- membresía ACTIVO o con períodos superpuestos, ANTES de crear cualquier
-- restricción en la base. NO modifica nada.
-- NO ejecutar automáticamente: correr a mano en el SQL Editor de Supabase, una
-- consulta por vez. Devuelve ids y fechas; no copiar DNI/emails a tickets o chats.
--
-- Convención de período usada para "superponer": [fecha_inicio, fecha_fin)
-- (semiabierto). La renovación actual arranca la nueva en la fecha_fin de la
-- anterior, así que dos membresías CONSECUTIVAS no cuentan como superpuestas;
-- sí cuentan las que comparten al menos un día más allá de ese borde.

-- 1) Usuarios con más de una membresía ACTIVO (incluye renovaciones legítimas
--    "en cola": la segunda empieza cuando termina la primera; ver consulta 3).
SELECT m.usuario_id,
       COUNT(*)                      AS activas,
       MIN(m.fecha_inicio)           AS primer_inicio,
       MAX(m.fecha_fin)              AS ultimo_fin
FROM public.membresias m
WHERE m.estado = 'ACTIVO'
GROUP BY m.usuario_id
HAVING COUNT(*) > 1
ORDER BY activas DESC, m.usuario_id;

-- 2) Pares de membresías (no SUSPENDIDO) del mismo usuario con períodos
--    superpuestos. a.id < b.id evita listar cada par dos veces.
--    "dias_superpuestos" = cuántos días comparten.
SELECT a.usuario_id,
       a.id AS membresia_a, a.estado AS estado_a, a.plan AS plan_a,
       a.fecha_inicio AS inicio_a, a.fecha_fin AS fin_a,
       b.id AS membresia_b, b.estado AS estado_b, b.plan AS plan_b,
       b.fecha_inicio AS inicio_b, b.fecha_fin AS fin_b,
       (LEAST(a.fecha_fin, b.fecha_fin) - GREATEST(a.fecha_inicio, b.fecha_inicio)) AS dias_superpuestos,
       (a.fecha_inicio = b.fecha_inicio AND a.fecha_fin = b.fecha_fin) AS mismas_fechas
FROM public.membresias a
JOIN public.membresias b
  ON b.usuario_id = a.usuario_id
 AND a.id < b.id
 AND a.fecha_inicio < b.fecha_fin
 AND b.fecha_inicio < a.fecha_fin
WHERE a.estado <> 'SUSPENDIDO'
  AND b.estado <> 'SUSPENDIDO'
ORDER BY a.usuario_id, GREATEST(a.fecha_inicio, b.fecha_inicio);

-- 3) Membresías ACTIVO que todavía no empezaron (fecha_inicio futura): hoy solo
--    las genera renovar(); sirven para ver cuántas "en cola" existen.
SELECT m.id AS membresia_id, m.usuario_id, m.plan, m.fecha_inicio, m.fecha_fin, m.creada_en
FROM public.membresias m
WHERE m.estado = 'ACTIVO' AND m.fecha_inicio > CURRENT_DATE
ORDER BY m.fecha_inicio;

-- 4) Detalle de las superpuestas con su pago: para decidir cuál conservar, cuál
--    reencadenar y si hubo doble cobro (dos pagos APROBADO casi simultáneos).
SELECT a.usuario_id,
       m.id AS membresia_id, m.estado, m.plan, m.fecha_inicio, m.fecha_fin, m.creada_en,
       p.id AS pago_id, p.estado AS pago_estado, p.monto, p.metodo, p.pagado_en
FROM public.membresias m
LEFT JOIN public.pagos p ON p.membresia_id = m.id
JOIN (
  SELECT DISTINCT x.usuario_id, x.id
  FROM public.membresias x
  JOIN public.membresias y
    ON y.usuario_id = x.usuario_id
   AND y.id <> x.id
   AND x.fecha_inicio < y.fecha_fin
   AND y.fecha_inicio < x.fecha_fin
  WHERE x.estado <> 'SUSPENDIDO' AND y.estado <> 'SUSPENDIDO'
) a ON a.id = m.id
ORDER BY a.usuario_id, m.fecha_inicio, m.creada_en;

-- 5) Disponibilidad de la extensión btree_gist (necesaria para una restricción
--    de exclusión sobre usuario_id + rango de fechas). Solo consulta catálogos.
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'btree_gist';
