-- Reversión de 004-tipos-cancha.sql
-- Vuelve de catálogo (tipos_cancha) al enum fijo tipo_cancha. Las canchas de
-- un tipo que no sea Paddle o Fútbol5 no tienen equivalente en el enum: el
-- bloque aborta antes de tocar nada si existe alguna.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.canchas c
    JOIN public.tipos_cancha t ON t.id = c.tipo_id
    WHERE t.nombre NOT IN ('Paddle', 'Fútbol5')
  ) THEN
    RAISE EXCEPTION 'Hay canchas de tipos sin equivalente en el enum tipo_cancha; reasignarlas antes de revertir';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cancha') THEN
    CREATE TYPE public.tipo_cancha AS ENUM ('PADDLE', 'FUTBOL5');
  END IF;
END $$;

ALTER TABLE public.canchas ADD COLUMN IF NOT EXISTS tipo public.tipo_cancha;

UPDATE public.canchas c
SET tipo = CASE t.nombre WHEN 'Paddle' THEN 'PADDLE'::public.tipo_cancha
                         ELSE 'FUTBOL5'::public.tipo_cancha END
FROM public.tipos_cancha t
WHERE t.id = c.tipo_id;

ALTER TABLE public.canchas ALTER COLUMN tipo SET NOT NULL;
ALTER TABLE public.canchas DROP CONSTRAINT IF EXISTS canchas_tipo_id_fkey;
ALTER TABLE public.canchas DROP COLUMN IF EXISTS tipo_id;
DROP TABLE IF EXISTS public.tipos_cancha;
