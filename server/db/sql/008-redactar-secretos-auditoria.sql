-- 008-redactar-secretos-auditoria.sql
-- Redacta password / token / secret / hash / authorization en las filas YA
-- guardadas de `auditoria.detalle`. Antes de la corrección del interceptor, el
-- body de algunas requests (login, cambio de contraseña, etc.) se guardaba tal
-- cual. Misma regla de claves que server/src/auditoria/redactar-secretos.helper.ts:
--     /pass(word)?|token|secret|hash|authorization/i   → valor "[REDACTADO]"
--
-- NO SE EJECUTÓ. Correr a mano en el SQL Editor de Supabase, en este orden:
--   PARTE 1 (solo lectura): cuenta cuántas filas se verían afectadas.
--   PARTE 2 (escribe): la redacción, dentro de una transacción.
--   PARTE 3 (solo lectura): verificar que no queda nada.
--   PARTE 4 (opcional, DDL): evitar que el trigger de pagos siga guardando el token.
--
-- Las funciones son TEMPORALES (pg_temp): viven solo en la sesión y no dejan
-- nada en el esquema. Hay que correr cada parte en la misma sesión que su
-- CREATE FUNCTION (el editor ejecuta todo el bloque pegado en una sesión).
-- La redacción es idempotente: correrla dos veces no cambia nada la segunda.
-- No se imprime ningún valor de `detalle`, solo conteos.

-- =====================================================================
-- PARTE 1 — SOLO LECTURA: cuántas filas tienen secretos sin redactar
-- =====================================================================
CREATE OR REPLACE FUNCTION pg_temp.redactar_json(v jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(v) = 'array' THEN
    RETURN COALESCE(
      (SELECT jsonb_agg(pg_temp.redactar_json(e)) FROM jsonb_array_elements(v) AS e),
      '[]'::jsonb
    );
  END IF;
  IF jsonb_typeof(v) = 'object' THEN
    RETURN COALESCE(
      (SELECT jsonb_object_agg(
                key,
                CASE WHEN key ~* 'pass(word)?|token|secret|hash|authorization'
                     THEN '"[REDACTADO]"'::jsonb
                     ELSE pg_temp.redactar_json(value) END)
         FROM jsonb_each(v)),
      '{}'::jsonb
    );
  END IF;
  RETURN v;
END
$f$;

SELECT count(*) AS filas_a_redactar
FROM public.auditoria
WHERE detalle IS NOT NULL
  AND pg_temp.redactar_json(detalle) IS DISTINCT FROM detalle;

-- Desglose por acción (solo acción/entidad, sin contenido):
SELECT accion, entidad, count(*) AS filas
FROM public.auditoria
WHERE detalle IS NOT NULL
  AND pg_temp.redactar_json(detalle) IS DISTINCT FROM detalle
GROUP BY accion, entidad
ORDER BY filas DESC;

-- =====================================================================
-- PARTE 2 — ESCRIBE: redacción. Revisar los conteos de la PARTE 1 antes.
-- (Requiere la función de la PARTE 1 en la misma sesión.)
-- Si el conteo final no es el esperado, cambiar COMMIT por ROLLBACK.
-- =====================================================================
BEGIN;

UPDATE public.auditoria
SET detalle = pg_temp.redactar_json(detalle)
WHERE detalle IS NOT NULL
  AND pg_temp.redactar_json(detalle) IS DISTINCT FROM detalle;

-- Debe dar 0 antes de confirmar:
SELECT count(*) AS quedan_sin_redactar
FROM public.auditoria
WHERE detalle IS NOT NULL
  AND pg_temp.redactar_json(detalle) IS DISTINCT FROM detalle;

COMMIT;

-- =====================================================================
-- PARTE 3 — SOLO LECTURA: verificación posterior (debe dar 0)
-- =====================================================================
SELECT count(*) AS quedan_sin_redactar
FROM public.auditoria
WHERE detalle IS NOT NULL
  AND pg_temp.redactar_json(detalle) IS DISTINCT FROM detalle;

-- =====================================================================
-- PARTE 4 — OPCIONAL (DDL, descomentar para aplicar): el trigger de pagos
-- (fn_auditoria_pagos) copia la fila completa del pago a `auditoria.detalle`,
-- incluido `token_pasarela`. Esta versión lo quita. Mantiene el resto igual.
-- =====================================================================
-- CREATE OR REPLACE FUNCTION public.fn_auditoria_pagos()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO auditoria (accion, entidad, entidad_id, detalle)
--   VALUES (
--     'DB_' || TG_OP,
--     'Pago',
--     COALESCE(NEW.id, OLD.id),
--     jsonb_build_object(
--       'antes', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) - 'token_pasarela' ELSE NULL END,
--       'despues', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) - 'token_pasarela' ELSE NULL END
--     )
--   );
--   RETURN COALESCE(NEW, OLD);
-- END;
-- $$ LANGUAGE plpgsql;
