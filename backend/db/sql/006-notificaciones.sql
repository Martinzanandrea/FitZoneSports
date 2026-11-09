-- 006-notificaciones.sql
-- Sistema de notificaciones para Socios (campanita + mail) y envíos del
-- Gerente General. Los datos actuales son de prueba: no hay migración de datos.
-- NO ejecutar automáticamente: correr a mano en el SQL Editor de Supabase.

-- 1) Envíos (avisos del Gerente General a una audiencia de Socios)
CREATE TABLE public.envios_notificacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo character varying(120) NOT NULL,
    mensaje character varying(1000) NOT NULL,
    audiencia character varying(30) NOT NULL,
    sede_id uuid,
    usuario_id uuid,
    -- Lista separada por comas, p. ej. 'PANEL,EMAIL' (simple-array de TypeORM).
    canales text NOT NULL,
    creado_por_id uuid NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    total_destinatarios integer DEFAULT 0 NOT NULL,
    emails_enviados integer DEFAULT 0 NOT NULL,
    emails_fallidos integer DEFAULT 0 NOT NULL,
    CONSTRAINT envios_notificacion_pkey PRIMARY KEY (id),
    CONSTRAINT envios_notificacion_audiencia_chk
        CHECK (audiencia IN ('TODOS_LOS_SOCIOS', 'SOCIOS_DE_SEDE', 'SOCIO')),
    CONSTRAINT envios_notificacion_sede_fkey FOREIGN KEY (sede_id)
        REFERENCES public.sedes (id),
    CONSTRAINT envios_notificacion_usuario_fkey FOREIGN KEY (usuario_id)
        REFERENCES public.usuarios (id),
    CONSTRAINT envios_notificacion_creado_por_fkey FOREIGN KEY (creado_por_id)
        REFERENCES public.usuarios (id)
);

CREATE INDEX idx_envios_notificacion_creada_en
    ON public.envios_notificacion (creada_en DESC);

-- 2) Notificaciones: una fila por destinatario
CREATE TABLE public.notificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    tipo character varying(40) NOT NULL,
    titulo character varying(120) NOT NULL,
    mensaje character varying(1000) NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    leida_en timestamp with time zone,
    envio_id uuid,
    CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
    CONSTRAINT notificaciones_tipo_chk
        CHECK (tipo IN ('CLASE_CANCELADA', 'LISTA_ESPERA_PROMOVIDA', 'AVISO_GENERAL')),
    CONSTRAINT notificaciones_usuario_fkey FOREIGN KEY (usuario_id)
        REFERENCES public.usuarios (id) ON DELETE CASCADE,
    CONSTRAINT notificaciones_envio_fkey FOREIGN KEY (envio_id)
        REFERENCES public.envios_notificacion (id) ON DELETE SET NULL
);

-- Listado y conteo de no leídas por usuario, más recientes primero.
CREATE INDEX idx_notificaciones_usuario
    ON public.notificaciones (usuario_id, leida_en, creada_en DESC);
