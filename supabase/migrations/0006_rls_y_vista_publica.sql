-- GroundTruth · Migración 0006 — Multi-tenancy (RLS) y verificador público
-- Fuente: Modelo-de-Datos §7. División de responsabilidades:
--   · RLS         → a qué FILAS accede un usuario (aislamiento por unidad / agricultor).
--   · NestJS      → qué ACCIÓN se permite (privilegios del sub-rol); usa service_role,
--                   que omite RLS — estas políticas protegen el acceso directo
--                   (Realtime, consultas anon/authenticated), no reemplazan al backend.

-- ---------- Funciones de soporte (SECURITY DEFINER: evitan recursión en políticas) ----------

create or replace function private.usuario_actual_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from usuarios where auth_user_id = auth.uid()
$$;

create or replace function private.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from usuarios where auth_user_id = auth.uid()), false)
$$;

create or replace function private.operadores_del_usuario()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.operador_id
  from membresias m
  join usuarios u on u.id = m.usuario_id
  where u.auth_user_id = auth.uid() and m.activo
$$;

-- ---------- Habilitar RLS en todas las tablas de dominio ----------

alter table operadores            enable row level security;
alter table usuarios              enable row level security;
alter table sub_roles             enable row level security;
alter table catalogo_privilegios  enable row level security;
alter table sub_rol_privilegios   enable row level security;
alter table membresias            enable row level security;
alter table cultivos              enable row level security;
alter table fincas                enable row level security;
alter table parcelas              enable row level security;
alter table nodos_sensores        enable row level security;
alter table lecturas_telemetria   enable row level security;
alter table ciclos_siembra        enable row level security;
alter table evidencias_satelitales enable row level security;
alter table certificados          enable row level security;
alter table alertas               enable row level security;
alter table tesorerias            enable row level security;
alter table movimientos_tesoreria enable row level security;
alter table embarques             enable row level security;
alter table embarque_parcelas     enable row level security;
alter table saga_certificacion    enable row level security;
alter table parametros_globales   enable row level security;
alter table parametros_cultivo    enable row level security;
alter table umbrales_eudr         enable row level security;
alter table auditoria             enable row level security;

-- ---------- Identidad ----------

create policy usuarios_self on usuarios for select to authenticated
  using (auth_user_id = auth.uid() or private.es_admin());

create policy operadores_miembros on operadores for select to authenticated
  using (id in (select private.operadores_del_usuario()) or private.es_admin());

create policy sub_roles_por_unidad on sub_roles for select to authenticated
  using (operador_id in (select private.operadores_del_usuario()) or private.es_admin());

create policy catalogo_lectura on catalogo_privilegios for select to authenticated
  using (true); -- catálogo de plataforma: visible para todo usuario autenticado

create policy sub_rol_privilegios_por_unidad on sub_rol_privilegios for select to authenticated
  using (
    sub_rol_id in (
      select sr.id from sub_roles sr
      where sr.operador_id in (select private.operadores_del_usuario())
    ) or private.es_admin()
  );

create policy membresias_propias_o_unidad on membresias for select to authenticated
  using (
    usuario_id = private.usuario_actual_id()
    or operador_id in (select private.operadores_del_usuario())
    or private.es_admin()
  );

-- ---------- Dominio agro (miembro de la unidad O agricultor dueño O admin) ----------

create policy cultivos_lectura on cultivos for select to authenticated using (true);

create policy fincas_acceso on fincas for select to authenticated
  using (
    operador_id in (select private.operadores_del_usuario())
    or agricultor_id = private.usuario_actual_id()
    or private.es_admin()
  );

create policy parcelas_acceso on parcelas for select to authenticated
  using (
    finca_id in (
      select f.id from fincas f
      where f.operador_id in (select private.operadores_del_usuario())
         or f.agricultor_id = private.usuario_actual_id()
    ) or private.es_admin()
  );

create policy nodos_acceso on nodos_sensores for select to authenticated
  using (
    parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.operador_id in (select private.operadores_del_usuario())
         or f.agricultor_id = private.usuario_actual_id()
    ) or private.es_admin()
  );

create policy lecturas_acceso on lecturas_telemetria for select to authenticated
  using (
    parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.operador_id in (select private.operadores_del_usuario())
         or f.agricultor_id = private.usuario_actual_id()
    ) or private.es_admin()
  );

create policy ciclos_acceso on ciclos_siembra for select to authenticated
  using (
    parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.operador_id in (select private.operadores_del_usuario())
         or f.agricultor_id = private.usuario_actual_id()
    ) or private.es_admin()
  );

-- Única escritura directa del agricultor (Q6): declarar nueva siembra en SU finca.
create policy ciclos_declarar on ciclos_siembra for insert to authenticated
  with check (
    declarado_por = private.usuario_actual_id()
    and parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.agricultor_id = private.usuario_actual_id()
    )
  );

create policy evidencias_acceso on evidencias_satelitales for select to authenticated
  using (
    parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.operador_id in (select private.operadores_del_usuario())
    ) or private.es_admin()
  );

create policy certificados_acceso on certificados for select to authenticated
  using (
    parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.operador_id in (select private.operadores_del_usuario())
         or f.agricultor_id = private.usuario_actual_id()
    ) or private.es_admin()
  );

-- Alertas: bandeja Realtime de la DApp lite del agricultor + vista del operador.
create policy alertas_acceso on alertas for select to authenticated
  using (
    agricultor_id = private.usuario_actual_id()
    or parcela_id in (
      select p.id from parcelas p join fincas f on f.id = p.finca_id
      where f.operador_id in (select private.operadores_del_usuario())
    ) or private.es_admin()
  );

create policy alertas_marcar_leida on alertas for update to authenticated
  using (agricultor_id = private.usuario_actual_id())
  with check (agricultor_id = private.usuario_actual_id());

-- ---------- Tesorería, embarques y saga (solo miembros de la unidad / admin) ----------

create policy tesorerias_acceso on tesorerias for select to authenticated
  using (operador_id in (select private.operadores_del_usuario()) or private.es_admin());

create policy movimientos_acceso on movimientos_tesoreria for select to authenticated
  using (
    tesoreria_id in (
      select t.id from tesorerias t
      where t.operador_id in (select private.operadores_del_usuario())
    ) or private.es_admin()
  );

create policy embarques_acceso on embarques for select to authenticated
  using (operador_id in (select private.operadores_del_usuario()) or private.es_admin());

create policy embarque_parcelas_acceso on embarque_parcelas for select to authenticated
  using (
    embarque_id in (
      select e.id from embarques e
      where e.operador_id in (select private.operadores_del_usuario())
    ) or private.es_admin()
  );

create policy saga_acceso on saga_certificacion for select to authenticated
  using (
    embarque_id in (
      select e.id from embarques e
      where e.operador_id in (select private.operadores_del_usuario())
    ) or private.es_admin()
  );

-- ---------- Parámetros y auditoría ----------

create policy parametros_globales_lectura on parametros_globales for select to authenticated using (true);
create policy parametros_cultivo_lectura  on parametros_cultivo  for select to authenticated using (true);
create policy umbrales_lectura            on umbrales_eudr       for select to authenticated using (true);

create policy auditoria_por_unidad on auditoria for select to authenticated
  using (operador_id in (select private.operadores_del_usuario()) or private.es_admin());

-- ---------- Verificador público (V2) — §7.1 ----------
-- El rol anon NUNCA toca tablas base; solo esta vista, que materializa el
-- contrato de privacidad (sin nombre de agricultor, sin polígono preciso).

create view certificados_publicos as
select c.numero_publico, c.estado, c.cnft_asset_id,
       c.uri_geojson_arweave, c.hash_pdf, c.hash_imagen,
       c.emitido_en, c.vigente_hasta, c.revocado_en,
       cu.nombre as cultivo, f.pais
from certificados c
join parcelas p  on p.id = c.parcela_id
join fincas f    on f.id = p.finca_id
join cultivos cu on cu.id = p.cultivo_id
where c.estado <> 'DRAFT';

revoke all on certificados_publicos from anon, authenticated;
grant select on certificados_publicos to anon, authenticated;
