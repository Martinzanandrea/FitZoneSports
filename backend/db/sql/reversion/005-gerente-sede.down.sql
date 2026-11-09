-- Reversión de 005-gerente-sede.sql
-- Postgres no permite quitar valores de un enum, así que GERENTE_GENERAL y
-- GERENTE_SEDE quedan en el tipo. Lo que sí se revierte son los datos: todos
-- los gerentes vuelven al valor único GERENTE, sin sede asignada.
UPDATE public.usuarios
SET tipo_actor = 'GERENTE', sede_id = NULL
WHERE tipo_actor IN ('GERENTE_GENERAL', 'GERENTE_SEDE');
