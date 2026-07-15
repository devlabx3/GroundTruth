-- GroundTruth · Migración 0008 — Idioma por defecto de la unidad
-- La configuración del operador (O10) incluye el idioma por defecto de la
-- unidad (Sistema-de-Diseno §6). ISO 639-1, coincide con el roadmap i18n.

alter table operadores
  add column if not exists idioma_defecto char(2) not null default 'es';
