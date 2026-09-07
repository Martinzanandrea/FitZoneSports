-- ============================================================
-- 002-auditoria-tabla-y-trigger.sql
-- Tabla de auditoría (capa 1: interceptor de aplicación, ver
-- server/src/auditoria/) + trigger de Postgres en pagos (capa 2,
-- defensa ante cambios hechos fuera de la aplicación).
-- Ver docs/adr/0008-sistema-de-auditoria.md
-- ============================================================

CREATE TABLE auditoria (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES usuarios(id),
    accion      VARCHAR(100) NOT NULL,
    entidad     VARCHAR(100) NOT NULL,
    entidad_id  UUID,
    detalle     JSONB,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_actor ON auditoria(actor_id);
CREATE INDEX idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX idx_auditoria_creado ON auditoria(creado_en DESC);

CREATE OR REPLACE FUNCTION fn_auditoria_pagos()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_pagos
AFTER INSERT OR UPDATE OR DELETE ON pagos
FOR EACH ROW EXECUTE FUNCTION fn_auditoria_pagos();
