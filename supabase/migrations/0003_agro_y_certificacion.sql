-- GroundTruth · Migración 0003 — Dominio agro y certificación
-- Fuente: Modelo-de-Datos §2. Jerarquía Operador → Finca → Parcela → Ciclo → Certificado.

create table cultivos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text unique not null,
  hs_code    text, -- Sistema Armonizado (aduanas), interoperable con TRACES NT
  created_at timestamptz not null default now()
);

insert into cultivos (nombre, hs_code) values
  ('cafe',     '0901.11'),
  ('cacao',    '1801.00'),
  ('aguacate', '0804.40')
on conflict (nombre) do nothing;

create table fincas (
  id            uuid primary key default gen_random_uuid(),
  operador_id   uuid not null references operadores(id),
  agricultor_id uuid not null references usuarios(id), -- esta fila hace "agricultor" al usuario
  nombre        text not null,
  pais          char(2),
  ubicacion     geometry(Point, 4326),
  created_at    timestamptz not null default now()
);
create index fincas_ubicacion_gist on fincas using gist (ubicacion);
create index fincas_operador_idx on fincas (operador_id);
create index fincas_agricultor_idx on fincas (agricultor_id);

create table parcelas (
  id         uuid primary key default gen_random_uuid(),
  finca_id   uuid not null references fincas(id),
  cultivo_id uuid not null references cultivos(id), -- mono-cultivo por parcela
  nombre     text not null,
  geom       geometry(Polygon, 4326) not null,
  -- Área PostGIS: base de la regla de cobertura de sensores (el frontend solo estima).
  area_m2    numeric generated always as (st_area(geom::geography)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger parcelas_touch before update on parcelas
  for each row execute function private.touch_updated_at();
create index parcelas_geom_gist on parcelas using gist (geom);
create index parcelas_finca_idx on parcelas (finca_id);

create table nodos_sensores (
  id                 uuid primary key default gen_random_uuid(),
  parcela_id         uuid not null references parcelas(id),
  tipo_nodo          tipo_nodo not null,
  external_id        text,
  chirpstack_dev_eui text, -- nodos LoRaWAN reales (hardware futuro = zero changes)
  atecc608_pubkey    text, -- verifica la firma de cada lectura (cadena de custodia)
  activo             boolean not null default true,
  instalado_en       timestamptz,
  created_at         timestamptz not null default now()
);
create index nodos_parcela_idx on nodos_sensores (parcela_id);

-- Alto volumen (§6): particionada por mes desde el día 1 — convertir después es caro.
-- La PK incluye la clave de partición (requisito de Postgres).
create table lecturas_telemetria (
  id                  uuid not null default gen_random_uuid(),
  nodo_id             uuid not null references nodos_sensores(id),
  parcela_id          uuid not null references parcelas(id), -- denormalizado a propósito
  ts                  timestamptz not null,
  ph                  numeric(4,2),
  ec_us_cm            numeric(8,2),
  humedad_suelo_pct   numeric(5,2),
  temp_suelo_prof1_c  numeric(5,2),
  temp_suelo_prof2_c  numeric(5,2), -- insumo de inercia térmica (métrica derivada, no columna)
  firma_hex           text,
  estado_evaluado     estado_verificacion,
  created_at          timestamptz not null default now(),
  primary key (id, ts)
) partition by range (ts);

-- Particiones iniciales; el backend (cron) crea la del mes siguiente por adelantado.
create table lecturas_telemetria_2026_07 partition of lecturas_telemetria
  for values from ('2026-07-01') to ('2026-08-01');
create table lecturas_telemetria_2026_08 partition of lecturas_telemetria
  for values from ('2026-08-01') to ('2026-09-01');
create table lecturas_telemetria_2026_09 partition of lecturas_telemetria
  for values from ('2026-09-01') to ('2026-10-01');
create table lecturas_telemetria_default partition of lecturas_telemetria default;

create index lecturas_ts_brin on lecturas_telemetria using brin (ts);
create index lecturas_parcela_ts_idx on lecturas_telemetria (parcela_id, ts desc);

create table ciclos_siembra (
  id            uuid primary key default gen_random_uuid(),
  parcela_id    uuid not null references parcelas(id),
  estado        ciclo_estado not null default 'ACTIVO',
  declarado_por uuid not null references usuarios(id), -- backend valida: es el agricultor de la finca
  fecha_inicio  timestamptz not null,
  fecha_cierre  timestamptz,
  motivo_cierre text,
  created_at    timestamptz not null default now()
);
create index ciclos_parcela_idx on ciclos_siembra (parcela_id);

create table evidencias_satelitales (
  id                      uuid primary key default gen_random_uuid(),
  parcela_id              uuid not null references parcelas(id),
  storage_path_imagen     text not null,
  hash_imagen             char(64) not null check (hash_imagen ~ '^[a-f0-9]{64}$'),
  storage_path_pdf        text,
  hash_pdf                char(64) check (hash_pdf ~ '^[a-f0-9]{64}$'),
  producto_copernicus_id  text,
  timestamp_adquisicion   timestamptz,
  evalscript_version      text,
  bbox                    geometry(Polygon, 4326),
  crs                     text default 'EPSG:4326',
  resolucion_m            numeric,
  formato                 text check (formato in ('PNG','GeoTIFF')),
  created_at              timestamptz not null default now()
);
create index evidencias_parcela_idx on evidencias_satelitales (parcela_id);

-- Identidad del certificado = (parcela, ciclo) — llave de idempotencia del saga.
create table certificados (
  id                      uuid primary key default gen_random_uuid(),
  numero_publico          text unique, -- GT-AAAA-NNNNN; lo genera el backend al emitir
  parcela_id              uuid not null references parcelas(id),
  ciclo_siembra_id        uuid not null references ciclos_siembra(id),
  estado                  certificado_estado not null default 'DRAFT',
  cnft_asset_id           text check (cnft_asset_id is null or length(cnft_asset_id) between 32 and 44),
  uri_geojson_arweave     text,
  hash_pdf                char(64) check (hash_pdf is null or hash_pdf ~ '^[a-f0-9]{64}$'),
  hash_imagen             char(64) check (hash_imagen is null or hash_imagen ~ '^[a-f0-9]{64}$'),
  evidencia_id            uuid references evidencias_satelitales(id), -- snapshot congelado
  atestacion_switchboard  jsonb, -- reservado Fase B (gate TEE)
  emitido_en              timestamptz,
  vigente_hasta           timestamptz,
  revocado_en             timestamptz,
  revocado_motivo         text,
  revocado_por            uuid references usuarios(id),
  superseded_by           uuid references certificados(id),
  created_at              timestamptz not null default now(),
  unique (parcela_id, ciclo_siembra_id)
);

create table alertas (
  id                uuid primary key default gen_random_uuid(),
  parcela_id        uuid not null references parcelas(id),
  agricultor_id     uuid not null references usuarios(id),
  tipo              text not null check (tipo in ('IOT','SATELITAL')), -- solo IOT activo en MVP
  severidad         alerta_severidad not null default 'ALERTA',
  variable          text,
  valor             numeric,
  umbral_referencia numeric,
  mensaje           text, -- clave i18n, no texto libre
  leida_en          timestamptz,
  created_at        timestamptz not null default now()
);
create index alertas_bandeja_idx on alertas (agricultor_id, leida_en);
