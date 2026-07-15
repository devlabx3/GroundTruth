-- GroundTruth · Migración 0007 — Endurecimiento del rol anon (§7.1)
-- Supabase concede por defecto privilegios sobre public a anon; el contrato de
-- privacidad exige que anon SOLO vea certificados_publicos. RLS ya niega las
-- filas, pero se retira también el privilegio de tabla (defensa en profundidad).

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- Las tablas futuras tampoco deben exponerse a anon por defecto.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- Lo único que el visitante anónimo puede leer (verificador público V2):
grant select on certificados_publicos to anon;
