-- ============================================================================
-- MIGRACIÓN: referencia de catálogo para los tubos
-- Ejecutar UNA vez en el SQL Editor de tu Supabase. Se puede repetir sin riesgo
-- (usa "if not exists") y no toca datos existentes.
-- ============================================================================

-- 1. Cada TIPO de tubo (60X20, 40X20…) puede tener una referencia por defecto
--    del catálogo de perfiles (p. ej. C6020 – TUBO 60x20 CORTIZO).
alter table tipos_tubo
  add column if not exists catalogo_perfil_id bigint references catalogo_perfiles(id);

-- 2. Una TIPOLOGÍA puede, si quiere, imponer otra referencia para su tubo por
--    defecto (otro proveedor). Si está vacía, manda la del tipo de tubo.
alter table tipologias
  add column if not exists tubo_catalogo_perfil_id bigint references catalogo_perfiles(id);

-- 3. El registro de material distingue los cortes de tubo de los de perfil
--    (para decir «mirar en otro almacén» en vez de «pedir material»).
alter table orden_perfiles_uso
  add column if not exists es_tubo boolean not null default false;
