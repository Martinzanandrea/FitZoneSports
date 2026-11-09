-- 005-gerente-sede.sql
-- Etapa 1 del rol GERENTE_SEDE (ver ADR-020): divide GERENTE en
-- GERENTE_GENERAL (todo, como el Gerente actual) y GERENTE_SEDE
-- (limitado a su sede). NO ejecutar automáticamente: correr a mano
-- en el SQL Editor de Supabase, en DOS ejecuciones separadas.
--
-- NOTA Postgres: un valor recién agregado a un enum NO puede usarse
-- en la misma transacción que el ALTER TYPE. Por eso el archivo está
-- dividido en PARTE 1 y PARTE 2: ejecutar la PARTE 1, esperar a que
-- termine (commit), y recién después ejecutar la PARTE 2.
--
-- Con el script de migraciones (server/db/migrar.js) el archivo se ejecuta
-- solo: la marca "migrar:sin-transaccion" hace que cada tramo separado por
-- "migrar:corte" se confirme por separado, como pide Postgres.
-- migrar:sin-transaccion
--
-- NOTA 'GERENTE': Postgres no permite quitar valores de un enum
-- fácilmente, así que 'GERENTE' queda en el tipo aunque no se use
-- más. No eliminarlo: rompería backups/dumps que lo mencionen.

-- ============ PARTE 1 (primera ejecución) ============
ALTER TYPE public.tipo_actor ADD VALUE IF NOT EXISTS 'GERENTE_GENERAL';
-- migrar:corte
ALTER TYPE public.tipo_actor ADD VALUE IF NOT EXISTS 'GERENTE_SEDE';
-- migrar:corte

-- ============ PARTE 2 (segunda ejecución, DESPUÉS del commit de la PARTE 1) ============
-- Migra a todos los Gerentes actuales a Gerente General (nadie pierde acceso).
UPDATE public.usuarios SET tipo_actor = 'GERENTE_GENERAL' WHERE tipo_actor = 'GERENTE';
