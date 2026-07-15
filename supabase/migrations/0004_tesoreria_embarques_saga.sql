-- GroundTruth · Migración 0004 — Tesorería Pay-per-Proof, embarques y saga
-- Fuente: Modelo-de-Datos §3. Montos SIEMPRE en micro-USDC (BIGINT, 6 decimales).

create table tesorerias (
  id             uuid primary key default gen_random_uuid(),
  operador_id    uuid unique not null references operadores(id), -- 1:1 (D8)
  treasury_pda   text unique not null check (length(treasury_pda) between 32 and 44),
  ata_usdc       text unique not null check (length(ata_usdc) between 32 and 44),
  red            text not null check (red in ('devnet','mainnet')),
  -- Espejo, NO fuente de verdad: la fuente es la cuenta on-chain (webhook Helius).
  saldo_cache    bigint not null default 0,
  actualizado_en timestamptz,
  created_at     timestamptz not null default now()
);

create table embarques (
  id                         uuid primary key default gen_random_uuid(),
  operador_id                uuid not null references operadores(id), -- nunca cruza operadores
  cultivo_id                 uuid not null references cultivos(id),   -- regla de unicidad de cultivo
  estado                     embarque_estado not null default 'BORRADOR',
  creado_por                 uuid not null references usuarios(id),   -- requiere embarques.preparar
  aprobado_por               uuid references usuarios(id),            -- requiere certificados.emitir
  uri_geojson_agregado       text,
  storage_path_pdf_agregado  text,
  tarifa_manifiesto_cobrada  bigint,
  tx_manifest_signature      text,
  emitido_en                 timestamptz,
  created_at                 timestamptz not null default now()
);
create index embarques_operador_idx on embarques (operador_id);

create table movimientos_tesoreria (
  id                 uuid primary key default gen_random_uuid(),
  tesoreria_id       uuid not null references tesorerias(id),
  tipo               movimiento_tipo not null,
  monto              bigint not null, -- micro-USDC; negativo en débitos
  tx_signature       text unique not null, -- evita doble registro de la misma TX
  origen             text, -- wallet de origen en depósitos
  embarque_id        uuid references embarques(id), -- solo en débitos
  helius_webhook_id  text unique, -- idempotencia de la ingesta del webhook
  confirmado_en      timestamptz,
  created_at         timestamptz not null default now()
);
create index movimientos_tesoreria_idx on movimientos_tesoreria (tesoreria_id, created_at desc);

create table embarque_parcelas (
  embarque_id                   uuid not null references embarques(id),
  parcela_id                    uuid not null references parcelas(id),
  certificado_id                uuid not null references certificados(id), -- reutilizado o recién emitido
  es_nuevo                      boolean not null, -- true = minteado en este despacho (N del cobro)
  tarifa_certificacion_cobrada  bigint, -- solo si es_nuevo
  created_at                    timestamptz not null default now(),
  primary key (embarque_id, parcela_id)
);

-- Mitigación F4: el estado del saga vive aquí; el modal del frontend lo consume vía Realtime.
create table saga_certificacion (
  id                          uuid primary key default gen_random_uuid(),
  embarque_id                 uuid not null references embarques(id),
  estado                      saga_estado not null default 'CERT_PENDING',
  paso_actual                 text, -- descarga_satelital | subida_arweave | tx_solana | ...
  error_detalle               text,
  reintentable                boolean not null default true,
  intentos                    int not null default 0,
  certificate_id_idempotencia text unique, -- generada por el cliente; el reintento nunca duplica
  actualizado_en              timestamptz,
  created_at                  timestamptz not null default now()
);
create index saga_embarque_idx on saga_certificacion (embarque_id);
