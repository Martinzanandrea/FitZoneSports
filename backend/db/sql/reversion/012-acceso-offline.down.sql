-- Reversión de 012-acceso-offline.sql
DROP TABLE IF EXISTS public.eventos_acceso_offline;

ALTER TABLE public.control_acceso
    DROP CONSTRAINT IF EXISTS chk_acceso_metodo_ingreso;

ALTER TABLE public.control_acceso
    DROP COLUMN IF EXISTS observacion,
    DROP COLUMN IF EXISTS metodo_ingreso;
