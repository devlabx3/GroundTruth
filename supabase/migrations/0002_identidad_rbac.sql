-- GroundTruth · Migración 0002 — Identidad y RBAC dinámico
-- Fuente: Modelo-de-Datos §1. "rol ≠ persona": los roles se derivan, no se almacenan.

create table operadores (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  nit_o_id_fiscal text,
  pais           char(2),
  estado         operador_estado not null default 'PENDIENTE_ONCHAIN',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger operadores_touch before update on operadores
  for each row execute function private.touch_updated_at();

create table usuarios (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique not null, -- FK lógica a auth.users
  nombre          text not null,
  email           text unique not null,
  idioma          char(2) not null default 'es',
  es_admin        boolean not null default false,
  activo          boolean not null default true,
  desactivado_en  timestamptz,
  created_at      timestamptz not null default now()
);

create table sub_roles (
  id              uuid primary key default gen_random_uuid(),
  operador_id     uuid not null references operadores(id),
  nombre          text not null,
  es_autogenerado boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (operador_id, nombre),
  -- Permite FK compuesta desde membresias: el sub-rol debe ser de la misma unidad.
  unique (id, operador_id)
);

create table catalogo_privilegios (
  id           uuid primary key default gen_random_uuid(),
  clave        text unique not null,
  nombre       text not null,
  descripcion  text,
  sensible     boolean not null default false,
  deprecado_en timestamptz,
  created_at   timestamptz not null default now()
);

create table sub_rol_privilegios (
  sub_rol_id    uuid not null references sub_roles(id),
  privilegio_id uuid not null references catalogo_privilegios(id),
  primary key (sub_rol_id, privilegio_id)
);

create table membresias (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuarios(id),
  operador_id  uuid not null references operadores(id),
  sub_rol_id   uuid not null,
  activo       boolean not null default true,
  invitado_en  timestamptz not null default now(),
  aceptado_en  timestamptz,
  created_at   timestamptz not null default now(),
  unique (usuario_id, operador_id),
  -- El sub-rol asignado pertenece al mismo operador (integridad por FK compuesta).
  foreign key (sub_rol_id, operador_id) references sub_roles(id, operador_id)
);

-- Guardarraíl "nunca sin timón" (§1.1): no se puede desactivar/eliminar la última
-- membresía activa cuyo sub-rol otorgue `equipo.gestionar` dentro de una unidad.
create or replace function private.guard_last_team_admin()
returns trigger language plpgsql as $$
declare
  otros int;
begin
  -- Solo interesa una membresía que HOY otorga gestión de equipo y está activa.
  if not old.activo then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if not exists (
    select 1 from sub_rol_privilegios srp
    join catalogo_privilegios cp on cp.id = srp.privilegio_id
    where srp.sub_rol_id = old.sub_rol_id and cp.clave = 'equipo.gestionar'
  ) then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  -- En UPDATE, si la fila sigue activa y su nuevo sub-rol conserva el privilegio, no hay fuga.
  if tg_op = 'UPDATE' and new.activo and exists (
    select 1 from sub_rol_privilegios srp
    join catalogo_privilegios cp on cp.id = srp.privilegio_id
    where srp.sub_rol_id = new.sub_rol_id and cp.clave = 'equipo.gestionar'
  ) then
    return new;
  end if;
  select count(*) into otros
  from membresias m
  join sub_rol_privilegios srp on srp.sub_rol_id = m.sub_rol_id
  join catalogo_privilegios cp on cp.id = srp.privilegio_id
  where m.operador_id = old.operador_id
    and m.activo
    and m.id <> old.id
    and cp.clave = 'equipo.gestionar';
  if otros = 0 then
    raise exception 'LAST_TEAM_ADMIN'
      using hint = 'La unidad no puede quedarse sin administración. Asigna el privilegio a otro miembro primero.';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end $$;

create trigger membresias_guard_last_admin
  before update or delete on membresias
  for each row execute function private.guard_last_team_admin();

-- Seed del catálogo de privilegios (§1.1) — espejo de src/lib/privileges.js del frontend.
insert into catalogo_privilegios (clave, nombre, sensible) values
  ('unidad.configurar',      'Configurar la unidad',            false),
  ('equipo.gestionar',       'Gestionar equipo y sub-roles',    false),
  ('agricultores.gestionar', 'Gestionar agricultores',          false),
  ('topologia.gestionar',    'Gestionar fincas y parcelas',     false),
  ('telemetria.ver',         'Ver telemetría',                  false),
  ('tesoreria.ver',          'Ver tesorería',                   false),
  ('embarques.preparar',     'Preparar embarques',              false),
  ('certificados.emitir',    'Emitir certificados',             true),
  ('certificados.revocar',   'Revocar certificados',            true),
  ('certificados.ver',       'Ver certificados',                false)
on conflict (clave) do nothing;
