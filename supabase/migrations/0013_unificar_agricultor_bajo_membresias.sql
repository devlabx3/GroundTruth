-- Paso 1: Unificar "agricultor" bajo membresía + sub_rol + privilegios
-- Agrega 3 privilegios nuevos con semántica "propio" (solo lo mío)
-- Crea sub_rol "Agricultor" autogenerado en cada unidad con esos 3 privilegios
-- Hace backfill de membresías para agricultores existentes

-- 1. Insertar los 3 privilegios nuevos en el catálogo global
insert into catalogo_privilegios (clave, nombre, descripcion)
values
  ('topologia.ver_propio', 'Ver topología propia', 'Ver y editar solo sus propias fincas, parcelas y ciclos de siembra'),
  ('telemetria.ver_propio', 'Ver telemetría propia', 'Ver solo lecturas de sensores en sus propias parcelas'),
  ('certificados.ver_propio', 'Ver certificados propios', 'Ver solo certificados de sus propias fincas')
on conflict (clave) do nothing;

-- 2. Para cada operador existente, crear el sub_rol "Agricultor" autogenerado
-- (análogo a cómo "Dirección" se crea al nacer la unidad)
insert into sub_roles (operador_id, nombre, es_autogenerado)
select id, 'Agricultor', true
from operadores
where not exists (
  select 1 from sub_roles sr
  where sr.operador_id = operadores.id and sr.nombre = 'Agricultor'
)
on conflict do nothing;

-- 3. Asignar los 3 privilegios nuevos al sub_rol "Agricultor" de cada operador
insert into sub_rol_privilegios (sub_rol_id, privilegio_id)
select sr.id, cp.id
from sub_roles sr
join operadores o on o.id = sr.operador_id
join catalogo_privilegios cp on cp.clave in ('topologia.ver_propio', 'telemetria.ver_propio', 'certificados.ver_propio')
where sr.nombre = 'Agricultor' and sr.es_autogenerado = true
on conflict (sub_rol_id, privilegio_id) do nothing;

-- 4. Backfill: crear membresías para agricultores existentes (fincas.agricultor_id -> usuarios)
-- Un agricultor con múltiples fincas en la misma unidad tiene una sola membresía
insert into membresias (usuario_id, operador_id, sub_rol_id, aceptado_en)
select distinct f.agricultor_id, f.operador_id, sr.id, now()
from fincas f
join sub_roles sr on sr.operador_id = f.operador_id and sr.nombre = 'Agricultor'
where not exists (
  select 1 from membresias m
  where m.usuario_id = f.agricultor_id and m.operador_id = f.operador_id
)
on conflict (usuario_id, operador_id) do nothing;

-- Agregar índice para las futuras queries de membresías de agricultor (optimización)
create index if not exists idx_membresias_agricultor
on membresias (usuario_id, operador_id)
where activo = true;
