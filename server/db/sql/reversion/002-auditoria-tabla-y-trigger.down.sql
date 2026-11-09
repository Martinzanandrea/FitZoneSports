-- Reversión de 002-auditoria-tabla-y-trigger.sql
-- Quita el trigger de auditoría de pagos y su función. La tabla auditoria
-- NO se borra: también la crea 001 y la usa el interceptor de la aplicación.
DROP TRIGGER IF EXISTS trg_auditoria_pagos ON public.pagos;
DROP FUNCTION IF EXISTS public.fn_auditoria_pagos();
