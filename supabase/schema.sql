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
  -- Ventana de edición del ciudadano (1 hora desde la creación).
  editado_at timestamptz,
  -- Palabras de cierre del técnico para el ciudadano.
  cierre_resultado text,
  mensaje_final text,
  mensaje_final_at timestamptz,
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
alter table public.incidencias add column if not exists editado_at timestamptz;
alter table public.incidencias add column if not exists cierre_resultado text;
alter table public.incidencias add column if not exists mensaje_final text;
alter table public.incidencias add column if not exists mensaje_final_at timestamptz;

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

-- Recorte de datos antiguos que ya excedan el límite del mensaje final,
-- para que el ADD CONSTRAINT no falle a mitad del script.
update public.incidencias set mensaje_final = left(mensaje_final, 300)
 where mensaje_final is not null and char_length(mensaje_final) > 300;

alter table public.incidencias drop constraint if exists incidencias_mensaje_final_len;
alter table public.incidencias
  add constraint incidencias_mensaje_final_len
  check (mensaje_final is null or char_length(mensaje_final) <= 300);

-- Cómo terminó el trabajo, según el técnico.
alter table public.incidencias drop constraint if exists incidencias_cierre_resultado_check;
alter table public.incidencias
  add constraint incidencias_cierre_resultado_check
  check (cierre_resultado is null or cierre_resultado in (
    'Resuelto',
    'No se resolvió',
    'Hacía falta maquinaria',
    'No era de mi competencia',
    'El reporte estaba equivocado'
  ));

-- ------------------------------------------------------------
-- La incidencia tiene que estar dentro de Cochabamba
-- ------------------------------------------------------------
-- El municipio solo atiende esta ciudad. Un punto en otro departamento, en
-- otra ciudad o en otro país no sirve: se aceptaría como válida y nadie iría
-- a trabajar ahí.
--
-- La app ya no deja marcarlo (src/lib/region.js acota el mapa y valida el
-- GPS), pero la app no es la barrera, la base de datos sí. Esta restricción
-- sigue ahí aunque alguien llame a la API directamente, que es exactamente
-- el mismo criterio que siguen el disparador de edición y el índice de
-- códigos únicos.
--
-- Los mismos números están en src/lib/region.js. Si se mueven, hay que
-- cambiarlos en los dos sitios.
alter table public.incidencias
  drop constraint if exists incidencias_coordenadas_check;

do $$
begin
  -- Si ya hay filas que no cumplirían la restricción, el ADD CONSTRAINT
  -- fallaría y abortaría el script entero a mitad. Se avisa y se deja todo
  -- como está, para no tocar datos de nadie sin que se decida a propósito.
  --
  -- La condición es la negación exacta de la de abajo, a propósito: así el
  -- guard no puede dejar pasar ningún caso que luego reviente. Cubre también
  -- las filas con una sola coordenada (lat sin lng, o al revés), que el
  -- límite de la app nunca genera pero una base antigua podría tener.
  if exists (
    select 1
    from public.incidencias
    where not (
      (lat is null and lng is null)
      or (lat between -17.5 and -17.2 and lng between -66.36 and -66.0)
    )
  ) then
    raise notice
      'Hay incidencias con coordenadas fuera de Cochabamba o incompletas: no se crea la restricción incidencias_coordenadas_check. Revísalas con verificar.sql.';
    return;
  end if;

  alter table public.incidencias
    add constraint incidencias_coordenadas_check
    check (
      -- O no hay ubicación, o la hay completa y dentro de la ciudad.
      (lat is null and lng is null)
      or (lat between -17.5 and -17.2 and lng between -66.36 and -66.0)
    );
end;
$$;

-- El horario de la app se apoya en este índice para ordenar de nuevo a
-- más reciente sin recorrer toda la tabla.
create index if not exists incidencias_created_at_idx
  on public.incidencias (created_at desc);

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
--   Técnico       → solo su informe, materiales, mensaje de cierre y el
--                    estado del reporte que tiene asignado
--   Ciudadano     → solo el contenido de su reporte (descripción,
--                    categoría, ubicación e imagen) y únicamente durante la
--                    primera hora. Pasada esa hora, o en cuanto el municipio
--                    lo pasa a "En proceso", queda bloqueado.
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

  -- service_role es la clave del backend: la usa el panel de Supabase para
  -- revisar y corregir datos a mano. Sin esta salida, abrir la tabla en el
  -- editor y tocar una fila daría el error de "ventana de 1 hora", porque
  -- para el trigger esa escritura no viene de ningún usuario con rol.
  --
  -- El papel se lee del claim del JWT y NO de current_user: esta función
  -- es security definer, así que current_user es siempre su propietario
  -- (postgres) y no quien llama. Comprobarlo aquí desactivaría el trigger
  -- entero sin avisar. Es lo mismo que hace auth.role() en Supabase.
  if coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       ''
     ) = 'service_role' then
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

    -- Si el técnico cierra el trabajo, tiene que explicar cómo quedó.
    -- Sin esto se podría cerrar en blanco llamando a la API y el
    -- ciudadano se enteraría del "Resuelto" sin ninguna explicación.
    if new.status = 'Resuelto' and old.status is distinct from new.status then
      if new.cierre_resultado is null then
        raise exception
          'Antes de cerrar el reporte, indica cómo terminó el trabajo.';
      end if;

      if btrim(coalesce(new.mensaje_final, '')) = ''
         or char_length(btrim(new.mensaje_final)) < 10 then
        raise exception
          'Escribe al menos 10 caracteres para el ciudadano: así sabrá cómo quedó el problema.';
      end if;
    end if;

    -- El sello de tiempo del mensaje de cierre lo pone la base de datos,
    -- no el cliente, para que no se pueda falsear.
    if new.mensaje_final is distinct from old.mensaje_final then
      new.mensaje_final_at := case
        when new.mensaje_final is null then null
        else coalesce(new.mensaje_final_at, now())
      end;
    end if;

    return new;
  end if;

  -- Todo lo demás es un ciudadano: no puede pasar su propio reporte a
  -- "Resuelto" ni reasignarlo, solo corregir lo que escribió.
  --
  -- La ventana de edición es de 1 hora desde la creación del reporte. Se
  -- avisa con mensajes distintos según cuál de las dos condiciones se
  -- incumplió, para que la app muestre un texto útil y no genérico.
  if old.status <> 'Pendiente' then
    raise exception
      'Este reporte ya no se puede editar porque pasó a «%».', old.status;
  end if;

  -- Ojo: el texto del intervalo va SIEMPRE en inglés. El parser de
  -- interval de Postgres no está localizado (ni depende de lc_time),
  -- así que '1 hora' da error y aborta el guardado. Los mensajes de
  -- error sí van en español, que es lo que lee la persona.
  if now() > old.created_at + interval '1 hour' then
    raise exception
      'Este reporte ya no se puede editar: la ventana de 1 hora para corregirlo ya se cumplió.';
  end if;

  if new.status is distinct from old.status
     or new.tecnico_id is distinct from old.tecnico_id
     or new.tecnico_nombre is distinct from old.tecnico_nombre
     or new.informe is distinct from old.informe
     or new.materiales is distinct from old.materiales
     or new.informe_at is distinct from old.informe_at
     or new.informe_image_url is distinct from old.informe_image_url
     or new.cierre_resultado is distinct from old.cierre_resultado
     or new.mensaje_final is distinct from old.mensaje_final
     or new.mensaje_final_at is distinct from old.mensaje_final_at
     or new.user_id is distinct from old.user_id then
    raise exception
      'Solo puedes modificar la descripción, la categoría, la ubicación y la imagen del reporte.';
  end if;

  -- Rastro de la última corrección del ciudadano.
  new.editado_at := now();

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
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- El administrador es quien asigna los roles, así que necesita poder
-- cambiar el de cualquier otro. Sin esta política, promover a un vecino
-- a Técnico (o degradarlo) solo era posible a mano desde el panel.
drop policy if exists "admin actualiza perfiles" on public.profiles;
create policy "admin actualiza perfiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- RLS decide a QUÉ fila puede escribir cada quien, pero no a qué columnas.
-- Con solo la política de arriba, un ciudadano podía mandarse a sí mismo
--
--   update profiles set role = 'Administrador' where id = <el suyo>
--
-- y passarse a ver todos los reportes del municipio. El rol se cambia
-- desde el panel de Supabase, nunca desde la app, así que aquí se bloquea
-- y se deja pasar solo lo que la app sí modifica por su cuenta.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_rol    text;
begin
  -- Si no hay claims NO es que la petición venga sin sesión: es que no hay
  -- ninguna petición detrás. PostgREST escribe ese GUC en cada request
  -- (aunque sea '{}' cuando no hay sesión), así que que esté a null solo
  -- pasa al conectarse directo a la base: SQL Editor, psql, cron o un
  -- script de mantenimiento.
  --
  -- Frenar ahí sería contraproducente: quien ya puede abrir el SQL Editor
  -- administra la base entera, y sin esta salida ningún UPDATE manual
  -- sobre profiles llegaría a completarse. Es además lo que permite que
  -- este mismo script más abajo pueda deduplicar códigos y crear el
  -- índice único.
  if v_claims is null then
    return new;
  end if;

  -- El rol se lee del claim y no de current_user a propósito: la función es
  -- SECURITY DEFINER, así que current_user dentro de ella es su dueño
  -- (postgres) siempre, y no distinguiría nada.
  v_rol := coalesce(nullif(v_claims, '')::jsonb ->> 'role', '');

  -- service_role: el panel y la Edge Function que da de alta al personal.
  if v_rol = 'service_role' then
    return new;
  end if;

  -- El administrador sí cambia roles y códigos: es su trabajo.
  if public.is_admin() then
    return new;
  end if;

  -- Cualquier otro solo puede retocar su propio nombre. Rol, código, correo
  -- y fecha de alta quedan fuera de su alcance, porque los tres primeros
  -- son las llaves con las que el municipio reconoce a su personal.
  if new.role is distinct from old.role
     or new.codigo is distinct from old.codigo then
    raise exception
      'El rol y el código de cuenta solo los asigna un administrador.';
  end if;

  -- Tampoco puede quedarse con un perfil que no sea el suyo, ni romper el
  -- vínculo con la cuenta de acceso ni falsear su fecha de alta.
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'No puedes cambiar tu identificador de cuenta.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil
  before update on public.profiles
  for each row execute procedure public.proteger_perfil();

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

-- ------------------------------------------------------------
-- Códigos de cuenta únicos
--
-- find_email_by_codigo devuelve una sola fila, así que si dos cuentas
-- compartieran código una de las dos quedaría inalcanzable al entrar por
-- código (nadie sabría a cuál de las dos pertenece el correo resuelto).
--
-- De cada grupo repetido sobrevive la más antigua y el resto se queda sin
-- código, que es un estado válido: el login por correo sigue funcionando.
-- La limpieza va antes del CREATE INDEX porque, si ya hubiera duplicados,
-- el índice fallaría y el script se detendría a mitad.
--
-- El UPDATE no lo frena proteger_perfil: este script se ejecuta desde el
-- SQL Editor, donde no hay petición de API detrás y por eso el trigger
-- deja pasar el cambio.
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
