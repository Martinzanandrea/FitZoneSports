-- Reversión de 001-schema-base.sql
-- Borra TODO el esquema public (tablas, tipos, funciones y datos) y lo deja
-- vacío. Es la reversión total: usar solo en desarrollo o pruebas.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
COMMENT ON SCHEMA public IS 'standard public schema';
