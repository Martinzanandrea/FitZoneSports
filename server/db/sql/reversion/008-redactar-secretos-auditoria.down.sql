-- Reversión de 008-redactar-secretos-auditoria.sql
-- La redacción de secretos en auditoria.detalle es IRREVERSIBLE a propósito:
-- los valores originales eran contraseñas y tokens que no deben recuperarse.
-- Este script no hace nada; existe para que el historial de reversiones
-- quede completo y el script de migraciones pueda retroceder más allá de 008.
SELECT 'La migración 008 no tiene reversión de datos (redacción de secretos)' AS aviso;
