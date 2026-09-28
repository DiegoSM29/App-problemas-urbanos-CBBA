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
  informe_image_url text,
  tecnico_id uuid references auth.users (id) on delete set null,
  tecnico_nombre text,
  informe text,
  materiales text,
  informe_at timestamptz,
  created_at timestamptz not null default now()
);

-- Migraciones para bases existentes (nuevas columnas)
alter table public.incidencias add column if not exists image_url text;
alter table public.incidencias add column if not exists informe_image_url text;
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

-- Límites de caracteres (los mismos que aplica la app en los formularios)
--
-- Antes de crear las restricciones hay que recortar cualquier reporte antiguo
-- que ya fuera más largo, porque si no el ADD CONSTRAINT falla y el script
-- se detiene a mitad. Se avisa con un NOTICE para que quede registrado.
do $$
declare
  v_titulos int;
  v_lugares int;
  v_informes int;
  v_materiales int;
begin
  update public.incidencias set title = left(title, 120)
   where char_length(title) > 120;
  get diagnostics v_titulos = row_count;

  update public.incidencias set place = left(place, 100)
   where char_length(place) > 100;
  get diagnostics v_lugares = row_count;

  update public.incidencias set informe = left(informe, 600)
   where informe is not null and char_length(informe) > 600;
  get diagnostics v_informes = row_count;

  update public.incidencias set materiales = left(materiales, 300)
   where materiales is not null and char_length(materiales) > 300;
  get diagnostics v_materiales = row_count;

  if v_titulos + v_lugares + v_informes + v_materiales > 0 then
    raise notice
      'Reportes antiguos recortados por exceder los nuevos limites (titulo %, lugar %, informe %, materiales %).',
      v_titulos, v_lugares, v_informes, v_materiales;
  end if;
end;
$$;

alter table public.incidencias drop constraint if exists incidencias_title_len;
alter table public.incidencias
  add constraint incidencias_title_len
  check (char_length(title) <= 120);

alter table public.incidencias drop constraint if exists incidencias_place_len;
alter table public.incidencias
  add constraint incidencias_place_len
  check (char_length(place) <= 100);

alter table public.incidencias drop constraint if exists incidencias_informe_len;
alter table public.incidencias
  add constraint incidencias_informe_len
  check (informe is null or char_length(informe) <= 600);

alter table public.incidencias drop constraint if exists incidencias_materiales_len;
alter table public.incidencias
  add constraint incidencias_materiales_len
  check (materiales is null or char_length(materiales) <= 300);

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
-- Reglas de edición por rol (aplicadas en la base de datos)
--
-- RLS decide a qué filas tiene acceso cada quien; este trigger decide a qué
-- COLUMNAS puede tocar cada rol, que es lo que RLS por sí solo no controla.
--
--   Administrador → todo
--   Técnico       → solo su informe, materiales y el estado del reporte
--                    que tiene asignado
--   Ciudadano     → solo el contenido de su reporte (descripción,
--                    categoría, ubicación e imagen) y únicamente mientras
--                    siga en "Pendiente". En cuanto pasa a "En proceso"
--                    o "Resuelto" queda bloqueado.
--
-- Importante: esto cierra también un hueco anterior. Con solo RLS, un
-- ciudadano podía marcar su propio reporte como "Resuelto" llamando a la API
-- directamente, sin pasar por el administrador.
-- ------------------------------------------------------------
create or replace function public.proteger_edicion_incidencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_tecnico boolean := auth.uid() is not null and auth.uid() = old.tecnico_id;
begin
  -- El administrador no tiene restricciones.
  if v_admin then
    return new;
  end if;

  -- El técnico solo completa el trabajo que le asignaron.
  if v_tecnico then
    if new.user_id is distinct from old.user_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.category is distinct from old.category
       or new.place is distinct from old.place
       or new.lat is distinct from old.lat
       or new.lng is distinct from old.lng
       or new.image_url is distinct from old.image_url
       or new.tecnico_id is distinct from old.tecnico_id
       or new.tecnico_nombre is distinct from old.tecnico_nombre then
      raise exception
        'El técnico solo puede registrar su informe, los materiales y el estado.';
    end if;
    return new;
  end if;

  -- Todo lo demás es un ciudadano: no puede pasar su propio reporte a
  -- "Resuelto" ni reasignarlo, solo corregir lo que escribió.
  if old.status <> 'Pendiente' then
    raise exception
      'Este reporte ya no se puede editar porque pasó a «%».', old.status;
  end if;

  if new.status is distinct from old.status
     or new.tecnico_id is distinct from old.tecnico_id
     or new.tecnico_nombre is distinct from old.tecnico_nombre
     or new.informe is distinct from old.informe
     or new.materiales is distinct from old.materiales
     or new.informe_at is distinct from old.informe_at
     or new.informe_image_url is distinct from old.informe_image_url
     or new.user_id is distinct from old.user_id then
    raise exception
      'Solo puedes modificar la descripción, la categoría, la ubicación y la imagen del reporte.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_edicion on public.incidencias;
create trigger trg_proteger_edicion
  before update on public.incidencias
  for each row execute function public.proteger_edicion_incidencia();

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

-- ============================================================
-- App conectada a Supabase (requisitos del cliente)
-- ============================================================

-- Código de cuenta (p. ej. CBA-1001, ADM-0001, TEC-0001) para login por código
alter table public.profiles add column if not exists codigo text;

-- RPC: resuelve un código a email sin sesión activa (RLS impide leer perfiles anónimos)
create or replace function public.find_email_by_codigo(p_codigo text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where lower(codigo) = lower(p_codigo) limit 1;
$$;

-- Bucket público para imágenes de incidencias (límite: 15 MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('incidencias', 'incidencias', true, 15728640)
on conflict (id) do nothing;

-- El insert anterior no actualiza el bucket si ya existía, así que se
-- sincroniza el límite aunque la base de datos sea vieja.
update storage.buckets
set file_size_limit = 15728640
where id = 'incidencias' and file_size_limit is distinct from 15728640;

drop policy if exists "iu_storage_insert" on storage.objects;
create policy "iu_storage_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'incidencias');

drop policy if exists "iu_storage_update" on storage.objects;
create policy "iu_storage_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'incidencias');

drop policy if exists "iu_storage_delete" on storage.objects;
create policy "iu_storage_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'incidencias');

-- ============================================================
-- Altas de cuentas: ciudadanos (autoregistro) y personal (solo admin)
-- ============================================================
--
-- Hay dos caminos de alta y cada uno tiene su propia barrera:
--
--   Ciudadano     → se registra solo desde la app (Supabase Auth signUp).
--                   El trigger handle_new_user lo deja SIEMPRE como
--                   'Ciudadano'. Aunque alguien manipule los metadatos del
--                   alta, el rol no se toma de ahí: se escribe fijo.
--
--   Técnico /
--   Administrador → los crea el administrador desde la app, que llama a la
--                   Edge Function "admin-create-user". Esa función exige que
--                   quien llame sea Administrador y usa la clave de servicio
--                   solo por dentro (esa clave nunca viaja en la app).
--
-- El siguiente trigger cierra el hueco que haría inútil todo lo anterior:
-- la política "actualizar perfil propio" permite a cualquiera actualizar su
-- propia fila, y RLS no distingue columnas. Sin más control, un ciudadano
-- podría escribirse role = 'Administrador' a sí mismo llamando a la API
-- directamente, sin tocar la app.
-- ------------------------------------------------------------

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Dos caminos de confianza, y solo dos:
  --
  --   · El panel de Supabase (Dashboard → SQL Editor), que se conecta con
  --     el rol postgres. Quien llega hasta ahí ya administra la base de
  --     datos entera, así que frenarlo no aportaría nada y sí rompería
  --     scripts como tecnicos.sql.
  --
  --   · La Edge Function admin-create-user, la única que usa la clave de
  --     servicio, y por eso la única autorizada a asignar roles.
  --
  -- Un ciudadano que entra por la API no cumple ninguno de los dos: PostgREST
  -- lo ejecuta con el rol authenticated y su claim también dice authenticated.
  --
  -- Ojo: la función es SECURITY INVOKER a propósito, para que current_user
  -- siga siendo el rol que ejecuta cada statement y no el dueño de la
  -- función. Si fuera SECURITY DEFINER, current_user valdría siempre postgres
  -- y la comprobación de arriba dejaría de distinguir nada.
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role' then
    return new;
  end if;

  -- El administrador sí puede cambiar roles, códigos y correos: es su trabajo.
  if public.is_admin() then
    return new;
  end if;

  -- Cualquier otro solo puede retocar su propio nombre. El rol, el código,
  -- el correo y la fecha de alta quedan fuera de su alcance.
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.codigo is distinct from old.codigo
     or new.created_at is distinct from old.created_at then
    raise exception
      'El rol y el código de cuenta solo los asigna un administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_perfil on public.profiles;
create trigger trg_proteger_perfil
  before update on public.profiles
  for each row execute function public.proteger_perfil();

-- La política "actualizar perfil propio" se vuelve a declarar para dejar el
-- WITH CHECK explícito: así el USING también valida el contenido nuevo.
drop policy if exists "actualizar perfil propio" on public.profiles;
create policy "actualizar perfil propio"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Códigos de cuenta únicos
--
-- El login acepta "código o correo" y find_email_by_codigo devuelve una sola
-- fila, así que un código repetido haría que una cuenta fuera inalcanzable.
--
-- De cada grupo (mismo código, sin importar mayúsculas) solo sobrevive el más
-- antiguo y el resto se queda sin código. Se hace antes de crear el índice
-- porque, si hubiera duplicados, el CREATE UNIQUE INDEX fallaría y el script
-- se detendría a mitad de la ejecución.
-- ------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by lower(codigo) order by created_at, id
         ) as rn
  from public.profiles
  where codigo is not null
)
update public.profiles p
   set codigo = null
  from ranked r
 where p.id = r.id
   and r.rn > 1;

create unique index if not exists profiles_codigo_unico
  on public.profiles (lower(codigo))
  where codigo is not null;
