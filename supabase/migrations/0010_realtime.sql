-- 0010 — Realtime: publicar las tablas que la interfaz necesita ver EN VIVO.
--
-- Regla de uso (importante, y distinta de lo habitual):
--   Realtime es una CAMPANA, no un cartero.
--
-- El cliente se suscribe, IGNORA el contenido del evento y lo único que hace con
-- él es invalidar su caché para volver a pedir el dato **por el backend**. Así se
-- respeta la regla del Sistema de Diseño §5 —todo dato de negocio pasa por
-- NestJS— sin abrir un segundo canal de datos hacia Postgres.
--
-- La privacidad la impone RLS, que Realtime evalúa POR SUSCRIPTOR: un operador
-- solo recibe eventos de las filas que sus políticas le dejan ver. Las tres
-- tablas tienen RLS activa (verificado: 2, 1 y 1 políticas respectivamente).

-- `lecturas_telemetria` está PARTICIONADA por mes. Con `publish_via_partition_root`
-- en false (el valor por defecto), los cambios se publican con la identidad de la
-- PARTICIÓN (`lecturas_telemetria_2026_07`), y un cliente suscrito a la tabla madre
-- no recibiría absolutamente nada. Este es el ajuste que hace que funcione.
alter publication supabase_realtime set (publish_via_partition_root = true);

-- Idempotente: `add table` falla si la tabla ya está en la publicación, y estas
-- migraciones deben poder re-aplicarse sobre una base existente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alertas'
  ) then
    -- F2: la razón de ser del producto. Un umbral EUDR que se rompe de madrugada
    -- no puede esperar a que el agricultor abra la app por la mañana.
    alter publication supabase_realtime add table public.alertas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lecturas_telemetria'
  ) then
    -- Estado verde/rojo de las parcelas en el panel y la topología del operador.
    alter publication supabase_realtime add table public.lecturas_telemetria;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tesorerias'
  ) then
    -- El depósito de USDC lo confirma la cadena y lo concilia el backend; sin esto,
    -- el operador ve su saldo viejo hasta que recarga.
    alter publication supabase_realtime add table public.tesorerias;
  end if;
end $$;
