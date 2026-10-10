-- 007-diagnostico-membresias.sql
-- DIAGNÓSTICO de solo lectura: detecta membresías huérfanas o incoherentes y
-- usuarios Socio sin membresía vigente coherente. NO modifica nada.
-- NO ejecutar automáticamente: correr a mano en el SQL Editor de Supabase, una
-- consulta por vez. Si alguna devuelve filas, revisar caso por caso antes de
-- corregir (esta migración NO corrige datos).
--
-- Las consultas devuelven ids y conteos; no hace falta (ni conviene) copiar
-- DNI, emails o teléfonos a tickets o chats.

-- 1) Membresías cuyo titular o sede no existen (las FK deberían impedirlo;
--    si aparece alguna, hay una FK deshabilitada o datos cargados a mano).
SELECT m.id AS membresia_id, m.usuario_id, m.sede_alta_id
FROM public.membresias m
LEFT JOIN public.usuarios u ON u.id = m.usuario_id
LEFT JOIN public.sedes s ON s.id = m.sede_alta_id
WHERE u.id IS NULL OR s.id IS NULL;

-- 2) Membresías cuyo titular no es Socio ni Externo (personal con membresía).
SELECT m.id AS membresia_id, u.id AS usuario_id, u.tipo_actor
FROM public.membresias m
JOIN public.usuarios u ON u.id = m.usuario_id
WHERE u.tipo_actor NOT IN ('SOCIO', 'EXTERNO');

-- 3) Membresías ACTIVO de usuarios dados de baja, o dadas de alta en una sede inactiva.
SELECT m.id AS membresia_id, u.id AS usuario_id, u.activo AS usuario_activo,
       s.id AS sede_id, s.activa AS sede_activa
FROM public.membresias m
JOIN public.usuarios u ON u.id = m.usuario_id
JOIN public.sedes s ON s.id = m.sede_alta_id
WHERE m.estado = 'ACTIVO' AND (NOT u.activo OR NOT s.activa);

-- 4) Usuarios SOCIO sin ninguna membresía ACTIVO vigente (hoy dentro de fecha_inicio..fecha_fin).
--    Un SOCIO nace de pagar una membresía (EXTERNO -> SOCIO); estos casos nacieron
--    por el registro público anterior (que aceptaba tipo SOCIO sin pago) o por
--    un cambio de rol manual.
SELECT u.id AS usuario_id, u.creado_en
FROM public.usuarios u
WHERE u.tipo_actor = 'SOCIO' AND u.activo
  AND NOT EXISTS (
    SELECT 1 FROM public.membresias m
    WHERE m.usuario_id = u.id
      AND m.estado = 'ACTIVO'
      AND CURRENT_DATE BETWEEN m.fecha_inicio AND m.fecha_fin
  );

-- 5) Usuarios EXTERNO con una membresía ACTIVO con pago aprobado (deberían ser SOCIO).
SELECT DISTINCT u.id AS usuario_id
FROM public.usuarios u
JOIN public.membresias m ON m.usuario_id = u.id AND m.estado = 'ACTIVO'
JOIN public.pagos p ON p.membresia_id = m.id AND p.estado = 'APROBADO'
WHERE u.tipo_actor = 'EXTERNO';

-- 6) Membresías ACTIVO sin ningún pago APROBADO (creadas sin cobrar, p. ej. un
--    pago rechazado que no llegó a cancelarla). Ver nota en el reporte: POST
--    /membresias permite crear una membresía ACTIVO sin pago previo.
SELECT m.id AS membresia_id, m.usuario_id, m.creada_en
FROM public.membresias m
WHERE m.estado = 'ACTIVO'
  AND NOT EXISTS (
    SELECT 1 FROM public.pagos p
    WHERE p.membresia_id = m.id AND p.estado = 'APROBADO'
  )
ORDER BY m.creada_en;

-- 7) Usuarios con más de una membresía ACTIVO a la vez (el servicio lo impide
--    al crear, pero no hay restricción en la base y dos altas simultáneas
--    podrían duplicarla).
SELECT m.usuario_id, COUNT(*) AS activas
FROM public.membresias m
WHERE m.estado = 'ACTIVO'
GROUP BY m.usuario_id
HAVING COUNT(*) > 1;

-- 8) ACTIVO con fecha_fin ya pasada (el cron diario de las 3 AM las marca VENCIDO;
--    si quedan acá, el cron no corrió).
SELECT m.id AS membresia_id, m.usuario_id, m.fecha_fin
FROM public.membresias m
WHERE m.estado = 'ACTIVO' AND m.fecha_fin < CURRENT_DATE;

-- ============================================================
-- OPCIONAL (cambio de esquema, NO incluido en el diagnóstico): cerraría la
-- carrera de dos membresías ACTIVO simultáneas. Solo aplicar si la consulta 7
-- no devuelve filas:
--   CREATE UNIQUE INDEX uq_membresia_activa_por_usuario
--     ON public.membresias (usuario_id) WHERE estado = 'ACTIVO';
-- Ojo: la renovación crea una fila nueva ACTIVO mientras la anterior sigue
-- ACTIVO hasta que vence, así que este índice exigiría antes cambiar ese flujo.
-- ============================================================
