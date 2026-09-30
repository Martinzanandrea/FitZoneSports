-- 003: verificación de email obligatoria al registrarse.
-- NO ejecutado automáticamente: correr en el SQL Editor de Supabase.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;
