-- 010-membresias-sin-superposicion.sql
-- No ejecutar hasta revisar los resultados de 009.
--
-- Impide en la base que un mismo usuario tenga dos membresías (no SUSPENDIDO)
-- con períodos superpuestos. Período = [fecha_inicio, fecha_fin): fecha_fin es
-- EXCLUSIVA (primer día en que ya no vale), así que dos membresías
-- consecutivas (la nueva empieza en la fecha_fin de la anterior) NO se
-- superponen. Ver docs/adr/0013-vigencia-de-membresias-por-fechas.md.
--
-- Orden de ejecución sugerido (a mano, en el SQL Editor de Supabase):
--   1) Correr 009 y limpiar los datos que devuelva (consultas 2 y 4).
--   2) Correr este script completo.
-- Este script NO modifica datos: solo crea la extensión y la restricción. Si
-- hay superposiciones, el primer bloque aborta con un mensaje y no crea nada.
--
-- Revertir (si hiciera falta):
--   ALTER TABLE public.membresias DROP CONSTRAINT excl_membresia_sin_superposicion;

-- 1) Abortar si existen membresías superpuestas por usuario (misma lógica que
--    la consulta 2 de 009).
DO $$
DECLARE
  cantidad integer;
BEGIN
  SELECT COUNT(*) INTO cantidad
  FROM public.membresias a
  JOIN public.membresias b
    ON b.usuario_id = a.usuario_id
   AND a.id < b.id
   AND a.fecha_inicio < b.fecha_fin
   AND b.fecha_inicio < a.fecha_fin
  WHERE a.estado <> 'SUSPENDIDO'
    AND b.estado <> 'SUSPENDIDO';

  IF cantidad > 0 THEN
    RAISE EXCEPTION
      'No se puede crear la restricción: hay % par(es) de membresías superpuestas por usuario. Corré 009-diagnostico-membresias-superpuestas.sql (consultas 2 y 4), resolvé esos datos y volvé a ejecutar este script.',
      cantidad;
  END IF;
END
$$;

-- 2) Extensión necesaria para combinar igualdad (usuario_id) y rango (GiST).
--    En Supabase está disponible; si el entorno la instala en el esquema
--    "extensions", el índice la resuelve igual.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 3) Restricción de exclusión. Las SUSPENDIDO (canceladas) quedan fuera para
--    que una cancelación no bloquee una compra nueva; reactivarla vuelve a
--    exigir que no se superponga (el servicio lo traduce a 409, SQLSTATE 23P01).
ALTER TABLE public.membresias
  ADD CONSTRAINT excl_membresia_sin_superposicion
  EXCLUDE USING gist (
    usuario_id WITH =,
    daterange(fecha_inicio, fecha_fin, '[)') WITH &&
  )
  WHERE (estado <> 'SUSPENDIDO');
