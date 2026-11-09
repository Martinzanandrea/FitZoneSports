-- 012-acceso-offline.sql
-- Soporte del acceso offline del terminal de recepción.
-- Migración ADITIVA: solo agrega columnas con DEFAULT y una tabla nueva, así
-- que el código anterior (INSERT INTO control_acceso (usuario_id, sede_id))
-- sigue funcionando con esta migración aplicada.

ALTER TABLE public.control_acceso
    ADD COLUMN IF NOT EXISTS metodo_ingreso varchar(12) DEFAULT 'QR' NOT NULL,
    ADD COLUMN IF NOT EXISTS observacion text;

ALTER TABLE public.control_acceso
    ADD CONSTRAINT chk_acceso_metodo_ingreso
    CHECK (metodo_ingreso IN ('QR', 'CODIGO', 'DNI', 'QR_OFFLINE'));

CREATE TABLE IF NOT EXISTS public.eventos_acceso_offline (
    client_event_id uuid NOT NULL,
    sede_id uuid NOT NULL,
    usuario_id uuid,
    qr_jti uuid,
    ocurrido_en timestamp with time zone NOT NULL,
    recibido_en timestamp with time zone DEFAULT now() NOT NULL,
    estado varchar(12) NOT NULL,
    codigo varchar(40) NOT NULL,
    mensaje text,
    acceso_id uuid,
    CONSTRAINT eventos_acceso_offline_pkey PRIMARY KEY (client_event_id),
    CONSTRAINT eventos_acceso_offline_sede_fkey FOREIGN KEY (sede_id)
        REFERENCES public.sedes (id),
    CONSTRAINT eventos_acceso_offline_usuario_fkey FOREIGN KEY (usuario_id)
        REFERENCES public.usuarios (id),
    CONSTRAINT eventos_acceso_offline_acceso_fkey FOREIGN KEY (acceso_id)
        REFERENCES public.control_acceso (id)
);

-- Un mismo QR no puede registrarse dos veces desde terminales distintos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_offline_jti
    ON public.eventos_acceso_offline (qr_jti)
    WHERE qr_jti IS NOT NULL;
