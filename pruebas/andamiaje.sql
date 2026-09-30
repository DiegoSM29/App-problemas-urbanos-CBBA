-- Andamiaje para ejecutar los scripts del proyecto fuera de Supabase.
--
-- Reproduce lo mínimo que estos scripts dan por hecho: los esquemas
-- auth y storage, la tabla auth.users con su sesión, y los roles
-- anon / authenticated. No es parte de la app: solo sirve para poder
-- correr schema.sql y notificaciones.sql contra un Postgres normal y
-- comprobar que no tienen errores de sintaxis ni de lógica.

create schema if not exists auth;
create schema if not exists storage;

create extension if not exists pgcrypto;

-- Equivalente de auth.users. En Supabase la gestiona el servicio de auth.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  -- Supabase guarda aquí los datos que manda el cliente al registrarse.
  -- El trigger on_auth_user_created de schema.sql lee el nombre de ahí.
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  created_at timestamptz not null default now()
);

-- La sesión activa, como la que Supabase inyecta en cada petición.
create schema if not exists auth_simulado;
create or replace function auth_simulado.set_usuario(usuario_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select u.id into v_id from auth.users u where u.email = usuario_email;

  if v_id is null then
    insert into auth.users (email) values (usuario_email) returning id into v_id;
  end if;

  -- request.jwt.claims es lo que lee auth.uid() en Supabase.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_id::text, 'email', usuario_email)::text,
    false
  );

  return v_id;
end;
$$;

-- En Supabase esto viene dado por el servicio de auth. Aquí se define
-- para que auth.uid() funcione igual. La definición es defensiva con
-- nullif, como la de Supabase: sin eso, dejar el claim vacío haría fallar
-- el cast a json en cuanto un trigger consultara el usuario.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

-- La conexión "anónima" de PostgREST. Se crean solo si no existen, para
-- que el andamiaje se pueda volver a ejecutar.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- En Supabase, `anon` y `authenticated` tienen todos los privilegios sobre
-- las tablas de `public` y la seguridad la imponen las políticas RLS, no los
-- permisos. Sin esto las pruebas fallarían por permisos y no llegarían a
-- comprobar las políticas, que es lo que interesa verificar.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
