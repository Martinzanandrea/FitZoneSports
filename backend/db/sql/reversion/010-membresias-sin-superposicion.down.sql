-- Reversión de 010-membresias-sin-superposicion.sql
-- Quita la restricción de exclusión. La extensión btree_gist se deja: es
-- inofensiva y otra restricción futura podría usarla.
ALTER TABLE public.membresias
    DROP CONSTRAINT IF EXISTS excl_membresia_sin_superposicion;
