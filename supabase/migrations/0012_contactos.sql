-- Formulario de contacto/demo (A10: persistencia de leads)
-- Tabla de solo-escritura (sin autenticación requerida, rate-limitada por IP en el backend).
-- Lectura futura: via Admin panel (fuera de alcance MVP).

create table contactos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  mensaje text not null,
  creado_en timestamptz not null default now()
);

create index contactos_creado_en_idx on contactos (creado_en desc);

-- Sin RLS: la tabla es de solo-escritura desde el backend (rol de servicio).
-- Lectura será via Admin, que tiene acceso irrestricto.
alter table contactos enable row level security;

-- Solo lectura (el Admin puede leer via bypassing RLS, ver GRANT abajo).
-- No hay política de insert porque la inscripción viene del backend autenticado.
create policy "no_direct_insert" on contactos
  for insert
  with check (false);

-- El rol de servicio (backend) puede hacer TODO sobre esta tabla.
grant all on contactos to service_role;
