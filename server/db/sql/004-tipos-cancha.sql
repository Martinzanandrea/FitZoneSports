-- 004-tipos-cancha.sql
-- Convierte TipoCancha de enum fijo a catálogo gestionable (tipos_cancha).
-- Migración en un solo paso: el entorno actual es solo de pruebas, no hay
-- datos reales que proteger. NO ejecutar automáticamente: correr a mano
-- en el SQL Editor de Supabase.

-- 1) Catálogo nuevo
CREATE TABLE public.tipos_cancha (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(60) NOT NULL,
    imagen_url character varying(500),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tipos_cancha_pkey PRIMARY KEY (id),
    CONSTRAINT tipos_cancha_nombre_key UNIQUE (nombre)
);

-- 2) Seed de los 2 tipos actuales. Las imágenes son las rutas estáticas
-- que ya sirven desde el frontend (client/public/images/landing/...),
-- no hace falta subirlas a Supabase Storage.
INSERT INTO public.tipos_cancha (nombre, imagen_url) VALUES
    ('Paddle', '/images/landing/paddle-cancha.jpg'),
    ('Fútbol5', '/images/landing/futbol5-cancha.jpg');

-- 3) Nueva columna FK en canchas (nullable durante el backfill)
ALTER TABLE public.canchas ADD COLUMN tipo_id uuid;

-- 4) Backfill: matchea el valor viejo del enum con el nombre del catálogo
UPDATE public.canchas c
SET tipo_id = t.id
FROM public.tipos_cancha t
WHERE (c.tipo::text = 'PADDLE' AND t.nombre = 'Paddle')
   OR (c.tipo::text = 'FUTBOL5' AND t.nombre = 'Fútbol5');

-- 5) FK + NOT NULL una vez backfillado
ALTER TABLE public.canchas
    ADD CONSTRAINT canchas_tipo_id_fkey FOREIGN KEY (tipo_id)
    REFERENCES public.tipos_cancha (id);
ALTER TABLE public.canchas ALTER COLUMN tipo_id SET NOT NULL;

-- 6) Elimina la columna vieja del enum
ALTER TABLE public.canchas DROP COLUMN tipo;

-- NOTA: el TYPE public.tipo_cancha queda sin uso (ninguna columna lo
-- referencia). Se deja a propósito sin DROP TYPE para no romper nada
-- si algún dump viejo lo menciona; puede eliminarse después con:
-- DROP TYPE IF EXISTS public.tipo_cancha;
