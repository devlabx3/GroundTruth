-- GroundTruth · Migración 0001 — Extensiones, tipos ENUM y utilidades
-- Fuente: GroundTruth-Modelo-de-Datos.md §0 y §5.

create extension if not exists pgcrypto;
create extension if not exists postgis;

-- Esquema interno para funciones de soporte (no expuesto por la API de Supabase).
create schema if not exists private;

-- §5 — ENUMs solo para máquinas de estado fijas del negocio.
create type operador_estado     as enum ('PENDIENTE_ONCHAIN','ACTIVO','SUSPENDIDO');
create type tipo_nodo           as enum ('SIMULADO','FISICO');
create type estado_verificacion as enum ('VERDE','ROJO');
create type ciclo_estado        as enum ('ACTIVO','CERRADO');
create type certificado_estado  as enum ('DRAFT','ACTIVE','SUPERSEDED','EXPIRED','REVOKED');
create type alerta_severidad    as enum ('INFO','ALERTA');
create type movimiento_tipo     as enum ('DEPOSITO','DEBITO_CERTIFICACION','DEBITO_MANIFIESTO');
create type embarque_estado     as enum ('BORRADOR','LISTO_APROBACION','PROCESANDO','EMITIDO','FALLIDO');
create type saga_estado         as enum ('CERT_PENDING','EVIDENCE_READY','ONCHAIN_CONFIRMED','FAILED');

-- Trigger genérico para `updated_at` (solo tablas mutables, §0).
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
