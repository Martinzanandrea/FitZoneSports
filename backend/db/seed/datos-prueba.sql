-- ============================================================
-- datos-prueba.sql
-- Set de datos de prueba para desarrollo y para la corrección:
--   * 25 sedes (ciudades de Entre Ríos) con horario de apertura
--   * 2 a 4 canchas por sede (Paddle y Fútbol5), una en mantenimiento
--   * 4 clases por sede con grilla semanal y ocurrencias para 4 semanas
--   * usuarios de todos los roles: Gerente General, Gerente de Sede,
--     Recepcionista, Socio (al día y en mora) y Cliente Externo
--   * precios de los planes de membresía
--
-- Todos los usuarios de prueba tienen la misma contraseña: FitZone2026!
-- (solo para pruebas; la tabla de usuarios por rol está en el README).
--
-- Se ejecuta con `node db/migrar.js seed`, después de las migraciones.
-- Si la base ya tiene sedes, el script no hace nada (no duplica datos).
-- ============================================================

DO $seed$
#variable_conflict use_variable
DECLARE
  hash_demo CONSTANT text := '$2b$10$jMoR/Ev942johopriZfb2OruKceGTYLqQS.PmEVfEoJiE3YbON7wS';
  hoy date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  ciudades text[] := ARRAY[
    'Paraná Centro', 'Paraná Norte', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay',
    'Gualeguay', 'Villaguay', 'Victoria', 'La Paz', 'Chajarí',
    'Federación', 'Colón', 'San José', 'Crespo', 'Diamante',
    'Nogoyá', 'Rosario del Tala', 'Federal', 'San Salvador', 'Villa Elisa',
    'Ramírez', 'Viale', 'Larroque', 'Basavilbaso', 'Santa Elena'
  ];
  calles text[] := ARRAY['San Martín', 'Urquiza', 'Belgrano', 'Sarmiento', '25 de Mayo'];
  tipos_clase text[] := ARRAY['Spinning', 'Yoga', 'Funcional', 'Pilates'];
  id_paddle uuid;
  id_futbol uuid;
  instructores_ids uuid[] := '{}';
  sede_id uuid;
  clase_id uuid;
  usuario_id uuid;
  i int;
  j int;
  d int;
  dia date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.sedes) THEN
    RAISE NOTICE 'La base ya tiene sedes: no se cargan datos de prueba.';
    RETURN;
  END IF;

  -- Precios de los planes
  INSERT INTO public.precios_plan (plan, precio) VALUES
    ('MENSUAL', 25000), ('TRIMESTRAL', 67500), ('ANUAL', 240000)
  ON CONFLICT (plan) DO NOTHING;

  -- Tipos de cancha (los crea la migración 004; se aseguran por si acaso)
  INSERT INTO public.tipos_cancha (nombre, imagen_url) VALUES
    ('Paddle', '/images/landing/paddle-cancha.jpg'),
    ('Fútbol5', '/images/landing/futbol5-cancha.jpg')
  ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO id_paddle FROM public.tipos_cancha WHERE nombre = 'Paddle';
  SELECT id INTO id_futbol FROM public.tipos_cancha WHERE nombre = 'Fútbol5';

  -- Instructores (no dependen de la sede: dan clases donde se los asigne)
  FOR i IN 1..12 LOOP
    INSERT INTO public.instructores (nombre, especialidad, telefono)
    VALUES (
      (ARRAY['Lucía Fernández','Martín Gómez','Sofía Ríos','Joaquín Benítez',
             'Valentina Acosta','Tomás Herrera','Camila Sosa','Nicolás Medina',
             'Julieta Romero','Facundo Ledesma','Agustina Ponce','Bruno Godoy'])[i],
      tipos_clase[1 + (i - 1) % 4],
      '343-55' || lpad(i::text, 5, '0')
    )
    RETURNING id INTO usuario_id;
    instructores_ids := instructores_ids || usuario_id;
  END LOOP;

  -- Gerente General (sin sede: ve toda la cadena)
  INSERT INTO public.usuarios
    (tipo_actor, dni, nombre, apellido, email, telefono, password_hash, sede_id, email_verificado)
  VALUES
    ('GERENTE_GENERAL', '20000001', 'Gabriela', 'Quiroga', 'gerente@fitzone.test',
     '343-4000001', hash_demo, NULL, true);

  FOR i IN 1..25 LOOP
    INSERT INTO public.sedes (nombre, direccion, aforo_maximo)
    VALUES (
      'FitZone ' || ciudades[i],
      calles[1 + (i - 1) % 5] || ' ' || (100 + i * 37) || ', ' || regexp_replace(ciudades[i], ' (Centro|Norte)$', ''),
      60 + (i % 5) * 20
    )
    RETURNING id INTO sede_id;

    INSERT INTO public.franjas_horarias (sede_id, apertura, cierre)
    VALUES (sede_id, '07:00', '23:00');

    -- Canchas: Paddle 1 y Fútbol5 1 siempre; las sedes impares suman más.
    INSERT INTO public.canchas (sede_id, nombre, tipo_id, costo_hora_base) VALUES
      (sede_id, 'Paddle 1', id_paddle, 12000),
      (sede_id, 'Fútbol 5 - 1', id_futbol, 30000);
    IF i % 2 = 1 THEN
      INSERT INTO public.canchas (sede_id, nombre, tipo_id, costo_hora_base) VALUES
        (sede_id, 'Paddle 2', id_paddle, 12000);
    END IF;
    IF i % 3 = 0 THEN
      -- Una cancha en mantenimiento para demostrar RF-12.
      INSERT INTO public.canchas (sede_id, nombre, tipo_id, costo_hora_base, estado) VALUES
        (sede_id, 'Fútbol 5 - 2', id_futbol, 30000, 'MANTENIMIENTO');
    END IF;

    -- Clases: 4 por sede, cada una dos veces por semana, 1 h por turno.
    FOR j IN 1..4 LOOP
      INSERT INTO public.clases (sede_id, tipo_clase, instructor_id, capacidad, horas_semanales_totales)
      VALUES (
        sede_id,
        tipos_clase[j],
        instructores_ids[1 + (i + j) % 12],
        CASE tipos_clase[j] WHEN 'Spinning' THEN 20 WHEN 'Yoga' THEN 15 ELSE 12 END,
        2
      )
      RETURNING id INTO clase_id;

      -- Spinning lun/mié, Yoga mar/jue, Funcional lun/vie, Pilates mar/sáb.
      INSERT INTO public.clase_horario_semanal (clase_id, dia_semana, hora_inicio, hora_fin)
      SELECT clase_id, x.dia, x.hi, x.hf
      FROM (VALUES
        (1, 1, '08:00'::time, '09:00'::time), (1, 3, '19:00'::time, '20:00'::time),
        (2, 2, '09:00'::time, '10:00'::time), (2, 4, '18:00'::time, '19:00'::time),
        (3, 1, '18:00'::time, '19:00'::time), (3, 5, '08:00'::time, '09:00'::time),
        (4, 2, '19:00'::time, '20:00'::time), (4, 6, '10:00'::time, '11:00'::time)
      ) AS x(clase, dia, hi, hf)
      WHERE x.clase = j;

      -- Ocurrencias de las próximas 4 semanas (lo mismo que hace el cron).
      FOR d IN 1..28 LOOP
        dia := hoy + d;
        INSERT INTO public.clase_ocurrencia (clase_id, fecha, hora_inicio, hora_fin)
        SELECT clase_id, dia, h.hora_inicio, h.hora_fin
        FROM public.clase_horario_semanal h
        WHERE h.clase_id = clase_id AND h.dia_semana = EXTRACT(DOW FROM dia)::int;
      END LOOP;
    END LOOP;

    -- Personal de la sede: un Gerente de Sede y un Recepcionista.
    INSERT INTO public.usuarios
      (tipo_actor, dni, nombre, apellido, email, telefono, password_hash, sede_id, email_verificado)
    VALUES
      ('GERENTE_SEDE', (21000000 + i)::text, 'Gerente', ciudades[i],
       'gerente.sede' || i || '@fitzone.test', '343-41' || lpad(i::text, 5, '0'), hash_demo, sede_id, true),
      ('RECEPCIONISTA', (22000000 + i)::text, 'Recepción', ciudades[i],
       'recepcion' || i || '@fitzone.test', '343-42' || lpad(i::text, 5, '0'), hash_demo, sede_id, true);

    -- Socios: 4 por sede. El 1 y 2 al día, el 3 con la cuota vencida
    -- (RN-03: paga tarifa de externo) y el 4 al día con plan anual.
    FOR j IN 1..4 LOOP
      INSERT INTO public.usuarios
        (tipo_actor, dni, nombre, apellido, email, telefono, password_hash, sede_id, email_verificado)
      VALUES (
        'SOCIO', (30000000 + i * 10 + j)::text,
        (ARRAY['Ana','Diego','Carla','Pablo','Laura','Iván','Mora','Gonzalo'])[1 + (i + j) % 8],
        (ARRAY['Pérez','López','García','Martínez','Díaz','Álvarez','Torres','Ruiz'])[1 + (i * j) % 8],
        'socio' || i || '.' || j || '@fitzone.test',
        '343-43' || lpad((i * 10 + j)::text, 5, '0'), hash_demo, sede_id, true
      )
      RETURNING id INTO usuario_id;

      IF j = 3 THEN
        INSERT INTO public.membresias (usuario_id, plan, estado, fecha_inicio, fecha_fin, sede_alta_id)
        VALUES (usuario_id, 'MENSUAL', 'VENCIDO', hoy - 45, hoy - 15, sede_id);
      ELSIF j = 4 THEN
        INSERT INTO public.membresias (usuario_id, plan, estado, fecha_inicio, fecha_fin, sede_alta_id)
        VALUES (usuario_id, 'ANUAL', 'ACTIVO', hoy - 30, hoy + 335, sede_id);
      ELSE
        INSERT INTO public.membresias (usuario_id, plan, estado, fecha_inicio, fecha_fin, sede_alta_id)
        VALUES (usuario_id, 'MENSUAL', 'ACTIVO', hoy - 5, hoy + 25, sede_id);
      END IF;
    END LOOP;

    -- Cliente externo: solo alquila canchas, sin membresía.
    INSERT INTO public.usuarios
      (tipo_actor, dni, nombre, apellido, email, telefono, password_hash, sede_id, email_verificado)
    VALUES (
      'EXTERNO', (40000000 + i)::text, 'Externo', ciudades[i],
      'externo' || i || '@fitzone.test', '343-44' || lpad(i::text, 5, '0'), hash_demo, sede_id, true
    );
  END LOOP;

  RAISE NOTICE 'Datos de prueba cargados: 25 sedes.';
END
$seed$;
