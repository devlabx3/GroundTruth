-- GroundTruth · Migración 0005 — Parámetros del sistema y auditoría
-- Fuente: Modelo-de-Datos §4. Umbrales/tarifas: configurables y provisionales (Q5, Q7).

create table parametros_globales (
  id              uuid primary key default gen_random_uuid(),
  clave           text unique not null,
  valor           numeric not null,
  descripcion     text,
  actualizado_por uuid references usuarios(id),
  actualizado_en  timestamptz,
  created_at      timestamptz not null default now()
);

-- Valores iniciales (coinciden con la maqueta del frontend):
insert into parametros_globales (clave, valor, descripcion) values
  ('tarifa_certificacion_usdc',    5,     'Tarifa por certificado nuevo, en USDC'),
  ('tarifa_manifiesto_usdc',       2,     'Tarifa por manifiesto de embarque, en USDC'),
  ('densidad_sensores_m2_default', 20000, 'Un sensor por cada N m² (default: 2 ha)')
on conflict (clave) do nothing;

create table parametros_cultivo (
  id         uuid primary key default gen_random_uuid(),
  cultivo_id uuid not null references cultivos(id),
  clave      text not null, -- vigencia_max_dias | densidad_sensores_m2
  valor      numeric not null,
  created_at timestamptz not null default now(),
  unique (cultivo_id, clave)
);

insert into parametros_cultivo (cultivo_id, clave, valor)
select id, 'vigencia_max_dias', 270 from cultivos
on conflict (cultivo_id, clave) do nothing;

create table umbrales_eudr (
  id         uuid primary key default gen_random_uuid(),
  cultivo_id uuid not null references cultivos(id),
  variable   text not null check (variable in ('ph','ec_us_cm','humedad_suelo_pct','temp_suelo_c')),
  valor_min  numeric not null,
  valor_max  numeric not null,
  created_at timestamptz not null default now(),
  unique (cultivo_id, variable),
  check (valor_min < valor_max)
);

-- Umbrales provisionales (criterio agronómico a calibrar en terreno — Q7).
insert into umbrales_eudr (cultivo_id, variable, valor_min, valor_max)
select c.id, v.variable, v.vmin, v.vmax
from cultivos c
join (values
  ('cafe',     'ph',                5.5, 6.8),
  ('cafe',     'humedad_suelo_pct', 35,  60),
  ('cacao',    'ph',                5.0, 7.0),
  ('cacao',    'humedad_suelo_pct', 40,  65),
  ('aguacate', 'ph',                5.5, 7.0),
  ('aguacate', 'humedad_suelo_pct', 30,  55)
) as v(cultivo, variable, vmin, vmax) on v.cultivo = c.nombre
on conflict (cultivo_id, variable) do nothing;

-- Auditoría genérica: cubre todo "queda auditado" de los casos de uso
-- (equipo, parámetros, revocaciones, reasignaciones) con una sola forma.
create table auditoria (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references usuarios(id), -- null si la acción es del sistema
  operador_id    uuid references operadores(id),
  accion         text not null, -- ej. sub_rol.crear, parametro.actualizar, certificado.revocar
  entidad        text not null, -- tabla afectada
  entidad_id     uuid,
  valor_anterior jsonb,
  valor_nuevo    jsonb,
  created_at     timestamptz not null default now()
);
create index auditoria_unidad_idx on auditoria (operador_id, created_at desc);
