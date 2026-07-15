-- 0011 — El semáforo de la parcela, materializado. Y con él, el Realtime que la 0010
-- no pudo dar.
--
-- POR QUÉ:
-- La 0010 publicó `lecturas_telemetria` para tener telemetría en vivo. **No funciona**:
-- comprobado contra la base real, Supabase Realtime NO entrega cambios de una tabla
-- PARTICIONADA — ni por la raíz, ni por el nombre de la partición, ni con comodín de
-- esquema. Poner `publish_via_partition_root = true` (que es necesario en Postgres) no
-- basta: el evento no llega. La publicación quedaba prometiendo algo que no ocurría.
--
-- LA SALIDA:
-- El semáforo verde/rojo no es la lectura: es una CONCLUSIÓN sobre la lectura. Se
-- materializa en `parcelas` —tabla normal, no particionada— con un disparador. Con eso:
--
--   1. Realtime funciona: `parcelas` sí publica.
--   2. Se avisa solo cuando el semáforo CAMBIA de verdad, no en cada lectura. Mil
--      lecturas que no alteran el estado no despiertan a nadie.
--   3. Desaparece la subconsulta correlacionada que 5 servicios ejecutaban POR PARCELA
--      contra la tabla particionada para averiguar el último estado.

alter table parcelas
  add column if not exists ultimo_estado    estado_verificacion,
  add column if not exists ultima_lectura_en timestamptz;

comment on column parcelas.ultimo_estado is
  'Semáforo EUDR derivado de la última lectura. Lo escribe SOLO el disparador '
  'trg_parcela_semaforo: no lo toque nadie a mano o el espejo se desincroniza.';

-- Relleno inicial: sin esto, las parcelas existentes quedarían en `pendiente` hasta
-- su próxima lectura, y la interfaz mostraría un retroceso.
update parcelas p
set ultimo_estado     = ult.estado_evaluado,
    ultima_lectura_en = ult.ts
from (
  select distinct on (parcela_id) parcela_id, estado_evaluado, ts
  from lecturas_telemetria
  order by parcela_id, ts desc
) ult
where ult.parcela_id = p.id;

/**
 * El disparador escribe SOLO cuando el estado cambia.
 *
 * Actualizar `parcelas` en cada lectura sería amplificación de escritura pura: un
 * UPDATE por sensor y por intervalo, con su hinchazón de tabla y su evento de Realtime
 * — para decir lo mismo que ya se sabía. `is distinct from` también cubre el NULL de
 * una parcela que nunca reportó (NULL <> 'VERDE' no sirve; `is distinct from` sí).
 */
create or replace function parcela_semaforo() returns trigger
language plpgsql
as $$
begin
  update parcelas
     set ultimo_estado     = new.estado_evaluado,
         ultima_lectura_en = new.ts
   where id = new.parcela_id
     and ultimo_estado is distinct from new.estado_evaluado;
  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;

drop trigger if exists trg_parcela_semaforo on lecturas_telemetria;

-- Disparador de fila sobre una tabla PARTICIONADA: Postgres lo propaga solo a todas
-- las particiones, presentes y futuras. No hay que tocarlo al crear la de octubre.
create trigger trg_parcela_semaforo
  after insert on lecturas_telemetria
  for each row
  execute function parcela_semaforo();

-- La publicación deja de mentir: fuera la tabla particionada (nunca entregó un evento),
-- dentro `parcelas`, que es la que la interfaz necesita escuchar.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'lecturas_telemetria'
  ) then
    alter publication supabase_realtime drop table public.lecturas_telemetria;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parcelas'
  ) then
    alter publication supabase_realtime add table public.parcelas;
  end if;
end $$;
