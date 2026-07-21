-- GroundTruth · Migración 0014 — Separar finca como entidad independiente
-- Objetivo: permitir crear fincas y parcelas sin necesidad de un agricultor previo.
-- Cambios:
--   1. agricultor_id deja de ser obligatorio en fincas (puede ser NULL).
--   2. Se agrega área a nivel de finca (dato de negocio, distinto del área geométrica de parcela).

-- Paso 1: hacer agricultor_id nullable (permite fincas sin dueño todavía)
alter table fincas
  alter column agricultor_id drop not null;

-- Paso 2: agregar área a nivel de finca (declarada por el operador)
alter table fincas
  add column area_ha numeric;

-- Paso 3: actualizar índice (ya no es obligatorio filtrar por agricultor)
-- El índice fincas_agricultor_idx sigue siendo útil para RLS policy performance,
-- pero ahora incluirá más NULLs — SQL los maneja bien (partial index no necesario aquí).
