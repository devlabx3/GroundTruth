-- GroundTruth · Migración 0009 — Ruta del PDF del certificado
--
-- El PDF es un artefacto DEL CERTIFICADO, no de la evidencia satelital: por eso
-- vive aquí y no en `evidencias_satelitales`, que exige imagen (y sin imagen no
-- hay evidencia satelital que registrar). Su hash ya estaba en `certificados`.
alter table certificados
  add column if not exists storage_path_pdf text;
