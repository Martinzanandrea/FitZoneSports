-- 011-push-suscripciones.sql
-- Tabla de suscripciones Web Push (una por navegador o dispositivo), usada
-- por el canal PUSH de notificaciones (server/src/notificaciones/push/).
-- En la base de Supabase la tabla se creó a mano desde el SQL Editor; este
-- script la deja versionada para que una base nueva quede igual.
-- Ver docs/adr/ADR-021 y la entidad push-suscripcion.entity.ts.

CREATE TABLE IF NOT EXISTS public.push_suscripciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_suscripciones_pkey PRIMARY KEY (id),
    CONSTRAINT push_suscripciones_endpoint_key UNIQUE (endpoint),
    CONSTRAINT push_suscripciones_usuario_fkey FOREIGN KEY (usuario_id)
        REFERENCES public.usuarios (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_suscripciones_usuario
    ON public.push_suscripciones (usuario_id);
