-- ============================================================================
-- MIGRACIÓN: stock mínimo de barras (aviso en el menú de inicio)
-- Ejecutar UNA vez en el SQL Editor de Supabase. Se puede repetir sin riesgo.
-- ============================================================================
create table if not exists stock_minimo_perfiles (
  id                 bigint generated always as identity primary key,
  catalogo_perfil_id bigint not null references catalogo_perfiles(id) on delete cascade,
  color_id           bigint not null references colores(id) on delete cascade,
  unidades_minimas   integer not null check (unidades_minimas >= 1),
  creado_en          timestamptz not null default now(),
  unique (catalogo_perfil_id, color_id)
);

alter table stock_minimo_perfiles enable row level security;

drop policy if exists "empleados_stock_minimo" on stock_minimo_perfiles;
create policy "empleados_stock_minimo" on stock_minimo_perfiles
  for all using (es_empleado_activo());
