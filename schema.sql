-- ============================================================
-- ILUXOL - Esquema de base de datos para Supabase (PostgreSQL)
-- Versión 2: incluye activar/desactivar en listas, fotos de
-- domicilio, y políticas de seguridad por usuario autenticado.
-- ============================================================

-- ------------------------------------------------------------
-- 1. LISTAS CONFIGURABLES (pantalla de Ajustes)
-- Todas con "activo" en vez de borrado, para no romper notas
-- antiguas cuando se desactiva un valor.
-- ------------------------------------------------------------

create table municipios (
    id bigint generated always as identity primary key,
    nombre text not null unique,
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

create table tipo_notas (
    id bigint generated always as identity primary key,
    nombre text not null unique,
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

create table asignados (
    id bigint generated always as identity primary key,
    nombre text not null unique,
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

create table llevar_opciones (
    id bigint generated always as identity primary key,
    nombre text not null unique,
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. CLIENTES
-- ------------------------------------------------------------

create table clientes (
    id bigint generated always as identity primary key,
    nombre text not null,
    telefono text,
    telefono2 text,
    email text,
    otros_datos text,
    lpd_firmado boolean not null default false,
    dni text,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

-- Documentos del cliente (ej: páginas del LOPD escaneado)
create table clientes_documentos (
    id bigint generated always as identity primary key,
    cliente_id bigint not null references clientes(id) on delete cascade,
    nombre_archivo text not null,
    ruta_storage text not null,   -- ruta dentro de Supabase Storage
    tipo text default 'LOPD',
    subido_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. DOMICILIOS (un cliente puede tener varios)
-- ------------------------------------------------------------

create table domicilios (
    id bigint generated always as identity primary key,
    cliente_id bigint not null references clientes(id) on delete cascade,
    direccion text not null,
    municipio_id bigint references municipios(id),
    zona text,
    datos_vivienda text,
    creado_en timestamptz not null default now()
);

-- Fotos de trabajos realizados en el domicilio
create table domicilios_fotos (
    id bigint generated always as identity primary key,
    domicilio_id bigint not null references domicilios(id) on delete cascade,
    ruta_storage text not null,
    descripcion text,
    subido_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. NOTAS (el núcleo del día a día)
-- ------------------------------------------------------------

create table notas (
    id bigint generated always as identity primary key,
    numero_nota integer unique,
    cliente_id bigint not null references clientes(id),
    domicilio_id bigint references domicilios(id),
    tipo_nota_id bigint references tipo_notas(id),
    asignado_id bigint references asignados(id),
    fecha_entrada date not null default current_date,
    observaciones text,
    llevar_id bigint references llevar_opciones(id),
    dia_cita date,
    hora_cita time,
    creado_por uuid references auth.users(id),
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. ÍNDICES para el buscador potente
-- ------------------------------------------------------------

create index idx_clientes_nombre on clientes using gin (to_tsvector('spanish', nombre));
create index idx_clientes_telefono on clientes (telefono);
create index idx_clientes_telefono2 on clientes (telefono2);
create index idx_clientes_email on clientes (email);
create index idx_domicilios_direccion on domicilios using gin (to_tsvector('spanish', direccion));
create index idx_notas_cliente on notas (cliente_id);
create index idx_notas_numero on notas (numero_nota);
create index idx_notas_dia_cita on notas (dia_cita);

-- ------------------------------------------------------------
-- 6. PERFILES DE EMPLEADO (vinculados al login de Supabase)
-- ------------------------------------------------------------

create table perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre_completo text not null,
    rol text not null default 'empleado' check (rol in ('admin', 'empleado')),
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. SEGURIDAD: solo empleados autenticados y activos pueden
-- leer/escribir. Esto es lo que sustituye a la contraseña
-- única del archivo .accdb por un control por persona.
-- ------------------------------------------------------------

alter table clientes enable row level security;
alter table clientes_documentos enable row level security;
alter table domicilios enable row level security;
alter table domicilios_fotos enable row level security;
alter table notas enable row level security;
alter table municipios enable row level security;
alter table tipo_notas enable row level security;
alter table asignados enable row level security;
alter table llevar_opciones enable row level security;
alter table perfiles enable row level security;

create or replace function es_empleado_activo()
returns boolean as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and activo = true
  );
$$ language sql security definer stable;

create policy "empleados_activos_acceso_clientes" on clientes
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_clientes_documentos" on clientes_documentos
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_domicilios" on domicilios
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_domicilios_fotos" on domicilios_fotos
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_notas" on notas
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_municipios" on municipios
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_tipo_notas" on tipo_notas
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_asignados" on asignados
  for all using (es_empleado_activo());
create policy "empleados_activos_acceso_llevar" on llevar_opciones
  for all using (es_empleado_activo());
create policy "empleados_ven_su_propio_perfil" on perfiles
  for select using (auth.uid() = id or es_empleado_activo());

-- ------------------------------------------------------------
-- 8. STORAGE: buckets para fotos de domicilio y documentos LOPD
-- Ejecuta esta sección una vez tengas el resto del esquema funcionando.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('domicilios-fotos', 'domicilios-fotos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('clientes-documentos', 'clientes-documentos', false)
on conflict (id) do nothing;

create policy "empleados_activos_storage_domicilios_fotos" on storage.objects
  for all using (bucket_id = 'domicilios-fotos' and es_empleado_activo());

create policy "empleados_activos_storage_clientes_documentos" on storage.objects
  for all using (bucket_id = 'clientes-documentos' and es_empleado_activo());
