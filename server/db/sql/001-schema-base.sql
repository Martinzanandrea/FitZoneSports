-- ============================================================
-- 001-schema-base.sql
-- Export del schema real (pg_dump --schema-only) contra la base de
-- Supabase del proyecto. TypeORM corre con synchronize:false — este
-- archivo es la referencia versionada de la estructura real, generada
-- el 9 de septiembre de 2026. Ver server/src/entities/*.entity.ts como fuente
-- de verdad del código; este .sql es el reflejo de la base ya creada.
-- Ver docs/adr/0002, 0003 y 0004 para las decisiones detrás de este
-- modelo.
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict HR2MO46BVeFMl3UNpkLQ3eVTWtBMaJzD7cGHxdnhc2W25Qdv89ijqeWam56fhNo

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: estado_cancha; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_cancha AS ENUM (
    'ACTIVA',
    'MANTENIMIENTO'
);


--
-- Name: estado_membresia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_membresia AS ENUM (
    'ACTIVO',
    'VENCIDO',
    'SUSPENDIDO'
);


--
-- Name: estado_ocurrencia_clase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_ocurrencia_clase AS ENUM (
    'PROGRAMADA',
    'CANCELADA'
);


--
-- Name: estado_pago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_pago AS ENUM (
    'PENDIENTE',
    'APROBADO',
    'RECHAZADO'
);


--
-- Name: estado_res_cancha; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_res_cancha AS ENUM (
    'CONFIRMADA',
    'CANCELADA'
);


--
-- Name: estado_res_clase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_res_clase AS ENUM (
    'RESERVADA',
    'LISTA_ESPERA',
    'CANCELADA',
    'ASISTIO',
    'NO_ASISTIO'
);


--
-- Name: metodo_pago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.metodo_pago AS ENUM (
    'MERCADOPAGO',
    'MODO',
    'EFECTIVO'
);


--
-- Name: tipo_actor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_actor AS ENUM (
    'SOCIO',
    'EXTERNO',
    'RECEPCIONISTA',
    'GERENTE'
);


--
-- Name: tipo_cancha; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_cancha AS ENUM (
    'PADDLE',
    'FUTBOL5'
);


--
-- Name: tipo_estrategia_precio; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_estrategia_precio AS ENUM (
    'ESTANDAR',
    'SOCIO_DESCUENTO',
    'HORA_PICO',
    'SOCIO_HORA_PICO'
);


--
-- Name: tipo_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_plan AS ENUM (
    'MENSUAL',
    'TRIMESTRAL',
    'ANUAL'
);


--
-- Name: fn_auditoria_pagos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_auditoria_pagos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO auditoria (accion, entidad, entidad_id, detalle)
  VALUES (
    'DB_' || TG_OP,
    'Pago',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'antes', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'despues', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    accion character varying(100) NOT NULL,
    entidad character varying(100) NOT NULL,
    entidad_id uuid,
    detalle jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bloqueos_cancha; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bloqueos_cancha (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cancha_id uuid NOT NULL,
    desde timestamp with time zone NOT NULL,
    hasta timestamp with time zone NOT NULL,
    motivo character varying(255),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_rango_bloqueo CHECK ((hasta > desde))
);


--
-- Name: canchas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canchas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sede_id uuid NOT NULL,
    nombre character varying(80) NOT NULL,
    tipo public.tipo_cancha NOT NULL,
    costo_hora_base numeric(10,2) NOT NULL,
    estado public.estado_cancha DEFAULT 'ACTIVA'::public.estado_cancha NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT canchas_costo_hora_base_check CHECK ((costo_hora_base > (0)::numeric))
);


--
-- Name: clase_horario_semanal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clase_horario_semanal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clase_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    CONSTRAINT chk_horario_semanal CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT clase_horario_semanal_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
);


--
-- Name: clase_ocurrencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clase_ocurrencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clase_id uuid NOT NULL,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estado public.estado_ocurrencia_clase DEFAULT 'PROGRAMADA'::public.estado_ocurrencia_clase NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sede_id uuid NOT NULL,
    tipo_clase character varying(80) NOT NULL,
    instructor_id uuid NOT NULL,
    capacidad integer NOT NULL,
    horas_semanales_totales numeric(4,1) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clases_capacidad_check CHECK ((capacidad > 0)),
    CONSTRAINT clases_horas_semanales_totales_check CHECK ((horas_semanales_totales > (0)::numeric))
);


--
-- Name: comprobantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comprobantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pago_id uuid NOT NULL,
    pdf_path text NOT NULL,
    generado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: control_acceso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.control_acceso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    sede_id uuid NOT NULL,
    hora_ingreso timestamp with time zone DEFAULT now() NOT NULL,
    hora_egreso timestamp with time zone,
    validado_offline boolean DEFAULT false NOT NULL,
    sincronizado_en timestamp with time zone
);


--
-- Name: franjas_horarias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franjas_horarias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sede_id uuid NOT NULL,
    apertura time without time zone NOT NULL,
    cierre time without time zone NOT NULL,
    CONSTRAINT chk_franja_horario CHECK ((cierre > apertura))
);


--
-- Name: instructores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instructores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(120) NOT NULL,
    especialidad character varying(120),
    telefono character varying(30),
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: membresias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membresias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    plan public.tipo_plan NOT NULL,
    estado public.estado_membresia DEFAULT 'ACTIVO'::public.estado_membresia NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    renovacion_auto boolean DEFAULT false NOT NULL,
    sede_alta_id uuid NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_fechas_membresia CHECK ((fecha_fin > fecha_inicio))
);


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    membresia_id uuid,
    reserva_clase_id uuid,
    reserva_cancha_id uuid,
    metodo public.metodo_pago NOT NULL,
    monto numeric(10,2) NOT NULL,
    token_pasarela character varying(255),
    registrado_por_id uuid,
    estado public.estado_pago DEFAULT 'PENDIENTE'::public.estado_pago NOT NULL,
    pagado_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pago_metodo_datos CHECK ((((metodo = 'EFECTIVO'::public.metodo_pago) AND (registrado_por_id IS NOT NULL) AND (token_pasarela IS NULL)) OR ((metodo <> 'EFECTIVO'::public.metodo_pago) AND (token_pasarela IS NOT NULL) AND (registrado_por_id IS NULL)))),
    CONSTRAINT chk_pago_referencia_unica CHECK ((((
CASE
    WHEN (membresia_id IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN (reserva_clase_id IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (reserva_cancha_id IS NOT NULL) THEN 1
    ELSE 0
END) = 1)),
    CONSTRAINT pagos_monto_check CHECK ((monto > (0)::numeric))
);


--
-- Name: precios_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precios_plan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan public.tipo_plan NOT NULL,
    precio numeric(10,2) NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT precios_plan_precio_check CHECK ((precio > (0)::numeric))
);


--
-- Name: reservas_cancha; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas_cancha (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cancha_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estrategia_precio public.tipo_estrategia_precio NOT NULL,
    precio_final numeric(10,2) NOT NULL,
    estado public.estado_res_cancha DEFAULT 'CONFIRMADA'::public.estado_res_cancha NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    cancelada_en timestamp with time zone,
    CONSTRAINT chk_horario_reserva_cancha CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT reservas_cancha_precio_final_check CHECK ((precio_final > (0)::numeric))
);


--
-- Name: reservas_clase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas_clase (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ocurrencia_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    estado public.estado_res_clase DEFAULT 'RESERVADA'::public.estado_res_clase NOT NULL,
    notificado boolean DEFAULT false NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    cancelada_en timestamp with time zone
);


--
-- Name: sedes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sedes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(120) NOT NULL,
    direccion character varying(255) NOT NULL,
    aforo_maximo integer NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sedes_aforo_maximo_check CHECK ((aforo_maximo > 0))
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_actor public.tipo_actor NOT NULL,
    dni character varying(20),
    nombre character varying(120) NOT NULL,
    apellido character varying(120) NOT NULL,
    email character varying(160) NOT NULL,
    telefono character varying(30),
    foto_url text,
    password_hash text NOT NULL,
    sede_id uuid,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_dni_requerido CHECK (((tipo_actor <> ALL (ARRAY['SOCIO'::public.tipo_actor, 'EXTERNO'::public.tipo_actor])) OR (dni IS NOT NULL))),
    CONSTRAINT chk_password_hash_formato CHECK ((length(password_hash) >= 50))
);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: bloqueos_cancha bloqueos_cancha_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueos_cancha
    ADD CONSTRAINT bloqueos_cancha_pkey PRIMARY KEY (id);


--
-- Name: canchas canchas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canchas
    ADD CONSTRAINT canchas_pkey PRIMARY KEY (id);


--
-- Name: clase_horario_semanal clase_horario_semanal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clase_horario_semanal
    ADD CONSTRAINT clase_horario_semanal_pkey PRIMARY KEY (id);


--
-- Name: clase_ocurrencia clase_ocurrencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clase_ocurrencia
    ADD CONSTRAINT clase_ocurrencia_pkey PRIMARY KEY (id);


--
-- Name: clases clases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases
    ADD CONSTRAINT clases_pkey PRIMARY KEY (id);


--
-- Name: comprobantes comprobantes_pago_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_pago_id_key UNIQUE (pago_id);


--
-- Name: comprobantes comprobantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_pkey PRIMARY KEY (id);


--
-- Name: control_acceso control_acceso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.control_acceso
    ADD CONSTRAINT control_acceso_pkey PRIMARY KEY (id);


--
-- Name: franjas_horarias franjas_horarias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franjas_horarias
    ADD CONSTRAINT franjas_horarias_pkey PRIMARY KEY (id);


--
-- Name: instructores instructores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructores
    ADD CONSTRAINT instructores_pkey PRIMARY KEY (id);


--
-- Name: membresias membresias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membresias
    ADD CONSTRAINT membresias_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: precios_plan precios_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_plan
    ADD CONSTRAINT precios_plan_pkey PRIMARY KEY (id);


--
-- Name: precios_plan precios_plan_plan_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_plan
    ADD CONSTRAINT precios_plan_plan_key UNIQUE (plan);


--
-- Name: reservas_cancha reservas_cancha_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_cancha
    ADD CONSTRAINT reservas_cancha_pkey PRIMARY KEY (id);


--
-- Name: reservas_clase reservas_clase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_clase
    ADD CONSTRAINT reservas_clase_pkey PRIMARY KEY (id);


--
-- Name: sedes sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey PRIMARY KEY (id);


--
-- Name: clase_ocurrencia uq_ocurrencia_clase_fecha_hora; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clase_ocurrencia
    ADD CONSTRAINT uq_ocurrencia_clase_fecha_hora UNIQUE (clase_id, fecha, hora_inicio);


--
-- Name: reservas_clase uq_reserva_usuario_ocurrencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_clase
    ADD CONSTRAINT uq_reserva_usuario_ocurrencia UNIQUE (ocurrencia_id, usuario_id);


--
-- Name: usuarios usuarios_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_dni_key UNIQUE (dni);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_acceso_sede_abiertos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acceso_sede_abiertos ON public.control_acceso USING btree (sede_id) WHERE (hora_egreso IS NULL);


--
-- Name: idx_auditoria_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_actor ON public.auditoria USING btree (actor_id);


--
-- Name: idx_auditoria_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_creado ON public.auditoria USING btree (creado_en DESC);


--
-- Name: idx_auditoria_entidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_entidad ON public.auditoria USING btree (entidad, entidad_id);


--
-- Name: idx_bloqueos_cancha_rango; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bloqueos_cancha_rango ON public.bloqueos_cancha USING btree (cancha_id, desde, hasta);


--
-- Name: idx_canchas_sede; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canchas_sede ON public.canchas USING btree (sede_id);


--
-- Name: idx_clases_sede; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clases_sede ON public.clases USING btree (sede_id);


--
-- Name: idx_franjas_sede; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_franjas_sede ON public.franjas_horarias USING btree (sede_id);


--
-- Name: idx_horario_semanal_clase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_horario_semanal_clase ON public.clase_horario_semanal USING btree (clase_id);


--
-- Name: idx_horario_semanal_dia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_horario_semanal_dia ON public.clase_horario_semanal USING btree (dia_semana);


--
-- Name: idx_horario_semanal_solape; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_horario_semanal_solape ON public.clase_horario_semanal USING btree (dia_semana, hora_inicio, hora_fin);


--
-- Name: idx_membresias_usuario_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membresias_usuario_estado ON public.membresias USING btree (usuario_id, estado);


--
-- Name: idx_membresias_vigencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membresias_vigencia ON public.membresias USING btree (usuario_id, fecha_fin DESC);


--
-- Name: idx_ocurrencia_clase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ocurrencia_clase ON public.clase_ocurrencia USING btree (clase_id);


--
-- Name: idx_ocurrencia_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ocurrencia_fecha ON public.clase_ocurrencia USING btree (fecha);


--
-- Name: idx_pagos_membresia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_membresia ON public.pagos USING btree (membresia_id) WHERE (membresia_id IS NOT NULL);


--
-- Name: idx_pagos_registrado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_registrado_por ON public.pagos USING btree (registrado_por_id) WHERE (registrado_por_id IS NOT NULL);


--
-- Name: idx_pagos_reserva_cancha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_reserva_cancha ON public.pagos USING btree (reserva_cancha_id) WHERE (reserva_cancha_id IS NOT NULL);


--
-- Name: idx_pagos_reserva_clase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_reserva_clase ON public.pagos USING btree (reserva_clase_id) WHERE (reserva_clase_id IS NOT NULL);


--
-- Name: idx_pagos_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_usuario ON public.pagos USING btree (usuario_id);


--
-- Name: idx_reservas_cancha_disponibilidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_cancha_disponibilidad ON public.reservas_cancha USING btree (cancha_id, fecha, hora_inicio);


--
-- Name: idx_reservas_clase_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_clase_estado ON public.reservas_clase USING btree (estado);


--
-- Name: idx_reservas_clase_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_clase_usuario ON public.reservas_clase USING btree (usuario_id);


--
-- Name: idx_usuarios_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_tipo ON public.usuarios USING btree (tipo_actor);


--
-- Name: uq_acceso_abierto_por_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_acceso_abierto_por_usuario ON public.control_acceso USING btree (usuario_id) WHERE (hora_egreso IS NULL);


--
-- Name: uq_cancha_horario_confirmado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cancha_horario_confirmado ON public.reservas_cancha USING btree (cancha_id, fecha, hora_inicio) WHERE (estado = 'CONFIRMADA'::public.estado_res_cancha);


--
-- Name: pagos trg_auditoria_pagos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auditoria_pagos AFTER INSERT OR DELETE OR UPDATE ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_pagos();


--
-- Name: auditoria auditoria_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.usuarios(id);


--
-- Name: bloqueos_cancha bloqueos_cancha_cancha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueos_cancha
    ADD CONSTRAINT bloqueos_cancha_cancha_id_fkey FOREIGN KEY (cancha_id) REFERENCES public.canchas(id) ON DELETE CASCADE;


--
-- Name: canchas canchas_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canchas
    ADD CONSTRAINT canchas_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: clase_horario_semanal clase_horario_semanal_clase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clase_horario_semanal
    ADD CONSTRAINT clase_horario_semanal_clase_id_fkey FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE;


--
-- Name: clase_ocurrencia clase_ocurrencia_clase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clase_ocurrencia
    ADD CONSTRAINT clase_ocurrencia_clase_id_fkey FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE;


--
-- Name: clases clases_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases
    ADD CONSTRAINT clases_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructores(id);


--
-- Name: clases clases_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clases
    ADD CONSTRAINT clases_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: comprobantes comprobantes_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comprobantes
    ADD CONSTRAINT comprobantes_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE CASCADE;


--
-- Name: control_acceso control_acceso_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.control_acceso
    ADD CONSTRAINT control_acceso_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- Name: control_acceso control_acceso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.control_acceso
    ADD CONSTRAINT control_acceso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: franjas_horarias franjas_horarias_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franjas_horarias
    ADD CONSTRAINT franjas_horarias_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE CASCADE;


--
-- Name: membresias membresias_sede_alta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membresias
    ADD CONSTRAINT membresias_sede_alta_id_fkey FOREIGN KEY (sede_alta_id) REFERENCES public.sedes(id);


--
-- Name: membresias membresias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membresias
    ADD CONSTRAINT membresias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: pagos pagos_membresia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_membresia_id_fkey FOREIGN KEY (membresia_id) REFERENCES public.membresias(id);


--
-- Name: pagos pagos_registrado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_registrado_por_id_fkey FOREIGN KEY (registrado_por_id) REFERENCES public.usuarios(id);


--
-- Name: pagos pagos_reserva_cancha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_reserva_cancha_id_fkey FOREIGN KEY (reserva_cancha_id) REFERENCES public.reservas_cancha(id);


--
-- Name: pagos pagos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: reservas_cancha reservas_cancha_cancha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_cancha
    ADD CONSTRAINT reservas_cancha_cancha_id_fkey FOREIGN KEY (cancha_id) REFERENCES public.canchas(id);


--
-- Name: reservas_cancha reservas_cancha_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_cancha
    ADD CONSTRAINT reservas_cancha_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: reservas_clase reservas_clase_ocurrencia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_clase
    ADD CONSTRAINT reservas_clase_ocurrencia_id_fkey FOREIGN KEY (ocurrencia_id) REFERENCES public.clase_ocurrencia(id) ON DELETE CASCADE;


--
-- Name: reservas_clase reservas_clase_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_clase
    ADD CONSTRAINT reservas_clase_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: usuarios usuarios_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id);


--
-- PostgreSQL database dump complete
--

\unrestrict HR2MO46BVeFMl3UNpkLQ3eVTWtBMaJzD7cGHxdnhc2W25Qdv89ijqeWam56fhNo

