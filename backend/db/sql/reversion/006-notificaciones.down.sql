-- Reversión de 006-notificaciones.sql
-- Borra las notificaciones de los socios y los envíos del Gerente General.
DROP TABLE IF EXISTS public.notificaciones;
DROP TABLE IF EXISTS public.envios_notificacion;
