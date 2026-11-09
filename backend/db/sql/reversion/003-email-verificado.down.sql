-- Reversión de 003-email-verificado.sql
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS email_verificado;
