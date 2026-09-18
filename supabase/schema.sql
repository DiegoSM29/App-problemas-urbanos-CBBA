-- ============================================================
-- Incidencias Urbanas CBBA - Esquema de base de datos (Supabase)
-- Roles: Ciudadano | Administrador | Técnico
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Perfiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nombre text,
  role text not null default 'Ciudadano',
  created_at timestamptz not null default now()
);

-- Migraciones para bases existentes
alter table public.profiles add column if not exists nombre text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('Ciudadano', 'Administrador', 'Técnico'));

alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- Incidencias
-- ------------------------------------------------------------
create table if not exists public.incidencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  title text not null,
  description text,
  category text not null default 'Vialidad',
  place text not null,
  status text not null default 'Pendiente',
  lat double precision,
  lng double precision,
  image_url text,
  tecnico_id uuid references auth.users (id) on delete set null,
  tecnico_nombre text,
  informe text,
  materiales text,
  informe_at timestamptz,
  created_at timestamptz not null default now()
);

-- Migraciones para bases existentes (nuevas columnas)
alter table public.incidencias add column if not exists image_url text;
alter table public.incidencias add column if not exists tecnico_id uuid references auth.users (id) on delete set null;
alter table public.incidencias add column if not exists tecnico_nombre text;
alter table public.incidencias add column if not exists informe text;
alter table public.incidencias add column if not exists materiales text;
alter table public.incidencias add column if not exists informe_at timestamptz;

-- Categorías ampliadas
alter table public.incidencias drop constraint if exists incidencias_category_check;
alter table public.incidencias
  add constraint incidencias_category_check
  check (category in (
    'Vialidad',
    'Iluminación',
    'Limpieza',
    'Agua y Alcantarillado',
    'Áreas Verdes',
    'Señalización',
    'Movilidad y Tránsito',
    'Otros'
  ));

-- Estados permitidos
alter table public.incidencias drop constraint if exists incidencias_status_check;
alter table public.incidencias
  add constraint incidencias_status_check
  check (status in ('Pendiente', 'En proceso', 'Resuelto'));

alter table public.incidencias enable row level security;

-- ------------------------------------------------------------
-- Helper: evita recursión de RLS al comprobar el rol admin
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Administrador'
  );
$$;

-- ------------------------------------------------------------
-- Políticas: profiles
-- ------------------------------------------------------------
drop policy if exists "select perfil propio" on public.profiles;
create policy "select perfil propio"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "admin lee perfiles" on public.profiles;
create policy "admin lee perfiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "insertar perfil propio" on public.profiles;
create policy "insertar perfil propio"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "actualizar perfil propio" on public.profiles;
create policy "actualizar perfil propio"
  on public.profiles for update
  using (auth.uid() = id);

-- ------------------------------------------------------------
-- Políticas: incidencias
-- ------------------------------------------------------------
drop policy if exists "ciudadano lee sus incidencias" on public.incidencias;
create policy "ciudadano lee sus incidencias"
  on public.incidencias for select
  using (auth.uid() = user_id);

drop policy if exists "admin lee todas las incidencias" on public.incidencias;
create policy "admin lee todas las incidencias"
  on public.incidencias for select
  using (public.is_admin());

drop policy if exists "tecnico lee sus incidencias" on public.incidencias;
create policy "tecnico lee sus incidencias"
  on public.incidencias for select
  using (auth.uid() = tecnico_id);

drop policy if exists "ciudadano crea incidencia" on public.incidencias;
create policy "ciudadano crea incidencia"
  on public.incidencias for insert
  with check (auth.uid() = user_id);

drop policy if exists "ciudadano actualiza su incidencia" on public.incidencias;
create policy "ciudadano actualiza su incidencia"
  on public.incidencias for update
  using (auth.uid() = user_id);

drop policy if exists "admin actualiza incidencias" on public.incidencias;
create policy "admin actualiza incidencias"
  on public.incidencias for update
  using (public.is_admin());

drop policy if exists "tecnico actualiza sus incidencias" on public.incidencias;
create policy "tecnico actualiza sus incidencias"
  on public.incidencias for update
  using (auth.uid() = tecnico_id);

-- ------------------------------------------------------------
-- Datos de ejemplo
-- ------------------------------------------------------------
insert into public.incidencias (title, category, place, status, lat, lng)
select v.title, v.category, v.place, v.status, v.lat, v.lng
from (values
  ('Bache en la avenida', 'Vialidad', 'Av. América', 'Pendiente', -17.3833, -66.1597),
  ('Iluminación defectuosa', 'Iluminación', 'Calle Colombia', 'En proceso', -17.3955, -66.1652),
  ('Basura acumulada', 'Limpieza', 'Parque Lincoln', 'Resuelto', -17.3891, -66.1573)
) as v(title, category, place, status, lat, lng)
where not exists (select 1 from public.incidencias);

-- ------------------------------------------------------------
-- Perfil automático al crear usuario en auth
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', null),
    'Ciudadano'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
