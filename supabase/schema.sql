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
  -- Reapertura: el ciudadano devuelve al municipio un reporte que le
  -- resolvieron y que en la calle sigue igual.
  reapertura_motivo text,
  reapertura_at timestamptz,
  reaperturas integer not null default 0,
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

-- Reapertura del reporte por el ciudadano.
alter table public.incidencias add column if not exists reapertura_motivo text;
alter table public.incidencias add column if not exists reapertura_at timestamptz;
alter table public.incidencias add column if not exists reaperturas integer not null default 0;

-- El motivo de la reapertura tiene el mismo ancho que el resto de textos
-- largos, y además no se acepta en blanco o demasiado corto: reabrir sin
-- explicar qué sigue mal deja al municipio sin nada con qué trabajar.
alter table public.incidencias drop constraint if exists incidencias_reapertura_motivo_len;
alter table public.incidencias
  add constraint incidencias_reapertura_motivo_len
  check (
    reapertura_motivo is null
    or (
      char_length(reapertura_motivo) between 10 and 300
      and btrim(reapertura_motivo) <> ''
    )
  );

-- Una reapertura siempre va acompañada de su fecha y su contador: es lo
-- que le dice al administrador cuántas veces volvió el caso a la cola.
alter table public.incidencias drop constraint if exists incidencias_reapertura_completa;
alter table public.incidencias
  add constraint incidencias_reapertura_completa
  check (
    (reapertura_at is null and reaperturas = 0)
    or (reapertura_at is not null and reaperturas >= 1)
  );

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
-- RPC: los reportes que se dibujan en el mapa
-- ------------------------------------------------------------
-- El municipio pidió que cualquier usuario con sesión pueda ver en el mapa
-- todos los reportes de la ciudad, no solo los suyos. La tabla no se abre
-- para eso: RLS sigue dejando a cada quien con lo suyo, y lo que se expone
-- al mapa es un recorte.
--
-- Por qué un RPC y no una política nueva de SELECT:
--   - La política "SELECT para todos" dejaría leer por API el informe, los
--     materiales, el mensaje final y hasta el nombre del técnico de
--     cualquier reporte, con solo pedir las columnas. Eso es información de
--     otra persona que el mapa no necesita para dibujar un pin.
--   - Aquí se devuelven ocho columnas: las justas para el pin y para el
--     globo que sale al tocarlo. Si algún día hace falta una más, se
--     revisa aquí primero.
--
-- Filtra los reportes sin coordenadas porque en el mapa no se dibujan: así
-- el contador de la pantalla y los pines que se ven son lo mismo.
create or replace function public.mapa_incidencias()
returns table (
  id uuid,
  title text,
  category text,
  place text,
  status text,
  lat double precision,
  lng double precision,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.title, i.category, i.place, i.status, i.lat, i.lng, i.created_at
  from public.incidencias i
  where auth.uid() is not null
    and i.lat is not null
    and i.lng is not null;
$$;

-- Sin sesión no hay mapa: anónimo no entra.
--
-- Ojo con esto: a una función nueva Postgres le da EXECUTE a PUBLIC, y
-- PUBLIC incluye a `anon`. Por eso hay que quitarle el permiso a PUBLIC y no
-- solo a `anon`: quitarle el permiso a `anon` no alcanzaría, porque el
-- permiso lo seguiría llegando por PUBLIC.
revoke execute on function public.mapa_incidencias() from public;
revoke execute on function public.mapa_incidencias() from anon;
grant execute on function public.mapa_incidencias() to authenticated;

-- ------------------------------------------------------------
-- Duplicados: la misma categoría en el mismo punto
-- ------------------------------------------------------------
-- El municipio pidió que un problema no se reporte dos veces: si ya hay un
-- reporte de «Iluminación» en esa calle, otro de «Iluminación» a menos de 30
-- metros del primero es la misma farola, el mismo bache o el mismo charco.
--
-- Por qué está aquí y no solo en la app: el trigger es la única barrera que
-- no se puede esquivar. src/services/reports.js avisa antes de enviar (es
-- instantáneo, no sube la foto y explica mejor qué encontró), pero quien
-- llame a la API sin pasar por la app entra por este mismo camino.
--
-- Es `security definer` a propósito: la comparación tiene que ver los reportes
-- de toda la ciudad. Con RLS, el trigger vería únicamente los del ciudadano
-- que escribe, que es justo el caso que se quiere atrapar (el vecino que ya
-- reportó la farola rota).
--
-- Los reportes «Resuelto» no cuentan para nada: el municipio ya fue a ese
-- punto, así que el problema puede haber vuelto (para eso está la reapertura),
-- y si contaran, una vez resuelta una esquina nadie podría volver a reportar
-- nada en ella.
--
-- El radio y la frase del aviso están también en src/lib/duplicados.js, y
-- pruebas/test-consistencia.js avisa si los dos lados dejan de coincidir.
--
-- El índice acompaña a la regla porque el trigger compara contra toda la
-- tabla en cada alta: la caja de un grado de latitud y otro de longitud deja
-- pasar solo lo que hay muy cerca, pero sin índice Postgres no puede usar el
-- filtro de categoría y tendría que recorrer la tabla entera.
create index if not exists incidencias_duplicado_idx
  on public.incidencias (category, lat, lng)
  where lat is not null and lng is not null;

create or replace function public.bloquear_reporte_duplicado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- El mismo número que RADIO_DUPLICADO_M en src/lib/duplicados.js.
  v_radio_m constant double precision := 30;
  -- Caja previa para no medir distancias de toda la ciudad: 0,001° de
  -- latitud son unos 111 m, bastante más que los 30 m del radio, así que
  -- ningún duplicado real puede quedarse fuera de la caja.
  v_caja constant double precision := 0.001;
  v_cercano record;
begin
  -- Sin punto no hay distancia que comparar. Un reporte sin ubicación no se
  -- frena: la regla es para lo que se reporta desde el mapa.
  if new.lat is null or new.lng is null then
    return new;
  end if;

  -- En una edición solo interesa si el reporte se movió o cambió de categoría.
  -- Corregir el título o la descripción de un reporte que ya existe no puede
  -- crear un duplicado, y frenarlo sí sería un molesto sin motivo.
  if tg_op = 'UPDATE'
     and new.lat is not distinct from old.lat
     and new.lng is not distinct from old.lng
     and new.category is not distinct from old.category then
    return new;
  end if;

  select d.id, d.title, d.place, d.status, d.metros
    into v_cercano
    from (
      select i.id, i.title, i.place, i.status,
             -- Haversine, el mismo cálculo y el mismo radio de la Tierra que
             -- hace la app (src/lib/duplicados.js). A dos metros del borde, los
             -- dos lados tienen que coincidir: si no, el reporte pasaría por la
             -- app y reventaría aquí.
             2 * 6371000 * asin(sqrt(
               power(sin(radians(i.lat - new.lat) / 2), 2)
               + cos(radians(new.lat)) * cos(radians(i.lat))
                 * power(sin(radians(i.lng - new.lng) / 2), 2)
             )) as metros
      from public.incidencias i
      where i.id is distinct from new.id
        and i.category = new.category
        and i.status <> 'Resuelto'
        and i.lat is not null
        and i.lng is not null
        and i.lat between new.lat - v_caja and new.lat + v_caja
        and i.lng between new.lng - v_caja and new.lng + v_caja
    ) d
   where d.metros <= v_radio_m
   order by d.metros
   limit 1;

  if v_cercano.id is not null then
    raise exception using
      errcode = '23514',
      message = format(
        'Ya hay un reporte de esta categoría a menos de %s metros de este punto. Ya está registrado como «%s» en %s (%s, a %s m).',
        v_radio_m,
        v_cercano.title,
        v_cercano.place,
        v_cercano.status,
        round(v_cercano.metros)
      );
  end if;

  return new;
end;
$$;

-- `update of lat, lng, category` a propósito: cambiar el estado, el informe o
-- el técnico no crea reportes nuevos, así que no tienen por qué pagar la
-- comparación. Y gracias a eso el técnico nunca se topa con esta regla, porque
-- mover un reporte o cambiarle la categoría sigue siendo cosa del ciudadano.
drop trigger if exists trg_reporte_duplicado on public.incidencias;
create trigger trg_reporte_duplicado
  before insert or update of lat, lng, category on public.incidencias
  for each row execute function public.bloquear_reporte_duplicado();

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
--                    Una excepción: si su reporte está «Resuelto» puede
--                    reabrirlo (volver a «Pendiente») escribiendo por qué,
--                    sin tocar nada más. Ver la rama de reapertura más
--                    abajo.
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
       or new.tecnico_nombre is distinct from old.tecnico_nombre
       -- La reapertura la escribe el ciudadano, no el técnico. Sin esto,
       -- el técnico podría poner un motivo de reapertura en un reporte que
       -- nunca se resolvió y la app mostraría "reabierto por la ciudadanía".
       or new.reapertura_motivo is distinct from old.reapertura_motivo
       or new.reapertura_at is distinct from old.reapertura_at
       or new.reaperturas is distinct from old.reaperturas then
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

  -- ------------------------------------------------------------
  -- Reapertura por el ciudadano.
  --
  -- Es la única excepción que tiene el ciudadano sobre el estado: si el
  -- municipio resolvió el problema y en la calle sigue igual, el vecino
  -- devuelve su reporte a la cola. Se admite solo de «Resuelto» a
  -- «Pendiente», sobre un reporte propio y con un motivo, y sin tocar
  -- NADA más en la misma operación (ni el título, ni el técnico, ni el
  -- informe, ni el dueño). El técnico se conserva a propósito: es el que
  -- conoce el caso y el que lo puede volver a revisar.
  --
  -- Devolver el estado a «Pendiente» por aquí no reabre la ventana de
  -- edición: el mantenimiento de abajo la sigue cerrando para quien ya
  -- tuvo su hora.
  -- ------------------------------------------------------------
  if old.status = 'Resuelto'
     and new.status = 'Pendiente'
     and old.user_id is not null
     and old.user_id = auth.uid() then

    if btrim(coalesce(new.reapertura_motivo, '')) = ''
       or char_length(btrim(new.reapertura_motivo)) < 10 then
      raise exception
        'Escribe al menos 10 caracteres explicando qué sigue mal: el municipio lo necesita para revisarlo.';
    end if;

    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.category is distinct from old.category
       or new.place is distinct from old.place
       or new.lat is distinct from old.lat
       or new.lng is distinct from old.lng
       or new.image_url is distinct from old.image_url
       or new.user_id is distinct from old.user_id
       or new.tecnico_id is distinct from old.tecnico_id
       or new.tecnico_nombre is distinct from old.tecnico_nombre
       or new.informe is distinct from old.informe
       or new.materiales is distinct from old.materiales
       or new.informe_at is distinct from old.informe_at
       or new.informe_image_url is distinct from old.informe_image_url
       or new.cierre_resultado is distinct from old.cierre_resultado
       or new.mensaje_final is distinct from old.mensaje_final
       or new.mensaje_final_at is distinct from old.mensaje_final_at then
      raise exception
        'Al reabrir solo puedes cambiar el estado y escribir el motivo.';
    end if;

    -- La fecha y el contador los pone la base de datos, no el cliente: si
    -- los mandara la app, un ciudadano podría fingir una reapertura de hace
    -- un mes y el historial del municipio mentiría.
    new.reapertura_motivo := left(btrim(new.reapertura_motivo), 300);
    new.reapertura_at := now();
    new.reaperturas := coalesce(old.reaperturas, 0) + 1;

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

  -- Un reporte reabierto vuelve a «Pendiente» pero no vuelve a ser editable:
  -- sus datos ya los leyó el municipio y el técnico cuando se resolvió.
  if old.reapertura_at is not null then
    raise exception
      'Este reporte se reabrió, así que sus datos ya no se pueden cambiar.';
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
     or new.user_id is distinct from old.user_id
     -- Los tres campos de la reapertura solo se rellenan por su rama, que
     -- ya salió por arriba. Aquí (cualquier otra edición del ciudadano)
     -- tienen que venir sin tocar: si no, podría dejar un motivo escrito en
     -- un reporte que nadie resolvió, y la app lo mostraría como
     -- "reabierto por la ciudadanía".
     or new.reapertura_motivo is distinct from old.reapertura_motivo
     or new.reapertura_at is distinct from old.reapertura_at
     or new.reaperturas is distinct from old.reaperturas then
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
