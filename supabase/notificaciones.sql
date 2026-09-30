-- ============================================================
-- Historial de reasignación de técnicos + bandeja de
-- notificaciones
-- ============================================================
-- Ejecución: Supabase → SQL Editor → New query → Run.
--
-- Es idempotente: se puede volver a ejecutarlo sin romper nada.
--
-- Requisitos: schema.sql ya ejecutado (profiles, incidencias,
-- is_admin() y proteger_edicion_incidencia() deben existir).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Historial de asignaciones de técnicos
-- ------------------------------------------------------------
-- Se guarda una fila por cada vez que se asigna, cambia o quita un
-- técnico. Sin esta tabla, cambiar de técnico solo sobrescribía el
-- nombre y el ciudadano nunca se enteraba de que había pasado.
create table if not exists public.incidencia_asignaciones (
  id uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references public.incidencias (id) on delete cascade,
  tecnico_id uuid references auth.users (id) on delete set null,
  tecnico_nombre text,
  asignado_por uuid references auth.users (id) on delete set null,
  asignado_por_nombre text,
  motivo text,
  rol text not null default 'asignacion',
  created_at timestamptz not null default now(),
  constraint incidencia_asignaciones_rol_check
    check (rol in ('asignacion', 'reasignacion', 'desasignacion'))
);

alter table public.incidencia_asignaciones enable row level security;

create index if not exists incidencia_asignaciones_incidencia_idx
  on public.incidencia_asignaciones (incidencia_id, created_at);

-- Helper: decide si quien pregunta puede ver el historial de una
-- incidencia. Es "security definer" para que las políticas de RLS no
-- se consulten entre sí (eso es recursión y Postgres la rechaza).
create or replace function public.puede_ver_asignacion(
  p_incidencia uuid,
  p_tecnico uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.incidencias i
    where i.id = p_incidencia
      and (
        public.is_admin()
        or i.user_id = auth.uid()
        or i.tecnico_id = auth.uid()
        or (i.tecnico_id is not null and i.tecnico_id = p_tecnico)
      )
  );
$$;

drop policy if exists "leer historial de asignaciones"
  on public.incidencia_asignaciones;
create policy "leer historial de asignaciones"
  on public.incidencia_asignaciones for select
  using (public.puede_ver_asignacion(incidencia_id, tecnico_id));

-- No hay política de INSERT: el historial lo escribe únicamente el
-- RPC de abajo, que valida el rol dentro de la misma transacción.

-- ------------------------------------------------------------
-- 2. RPC: asignar / cambiar / quitar el técnico de un reporte
-- ------------------------------------------------------------
-- Se usa en lugar de un UPDATE suelto por dos motivos:
--   1. Valida que quien llama sea administrador. RLS por sí solo no
--      permite exigir eso desde el cliente.
--   2. Actualiza el reporte y escribe el historial en la misma
--      transacción, así es imposible que quede un cambio de técnico
--      sin registrar.
create or replace function public.asignar_tecnico(
  p_incidencia uuid,
  p_tecnico uuid,
  p_nombre text default null,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior uuid;
  v_rol text;
  v_motivo text;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede asignar técnicos.';
  end if;

  select i.tecnico_id into v_anterior
  from public.incidencias i
  where i.id = p_incidencia;

  if not found then
    raise exception 'El reporte no existe.';
  end if;

  -- Elegir al mismo técnico que ya lo tiene no es un cambio: si se
  -- dejara pasar, el historial registraría una "reasignación" que nunca
  -- ocurrió y el ciudadano vería un aviso engañoso. La app ya lo
  -- bloquea, pero aquí se cierra por si se llama al RPC directamente.
  if p_tecnico is not null and p_tecnico = v_anterior then
    raise exception 'Ese técnico ya está asignado a este reporte.';
  end if;

  -- Un motivo en blanco se guarda como NULL, no como texto vacío.
  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');

  update public.incidencias
  set tecnico_id = p_tecnico,
      tecnico_nombre = case when p_tecnico is null then null else p_nombre end
  where id = p_incidencia;

  v_rol := case
    when p_tecnico is null then 'desasignacion'
    when v_anterior is not null then 'reasignacion'
    else 'asignacion'
  end;

  insert into public.incidencia_asignaciones
    (incidencia_id, tecnico_id, tecnico_nombre, asignado_por,
     asignado_por_nombre, motivo, rol)
  values
    (p_incidencia,
     p_tecnico,
     case when p_tecnico is null then null else left(p_nombre, 120) end,
     auth.uid(),
     (select pr.nombre from public.profiles pr where pr.id = auth.uid()),
     left(v_motivo, 200),
     v_rol);
end;
$$;

revoke execute on function public.asignar_tecnico(uuid, uuid, text, text)
  from anon;
grant execute on function public.asignar_tecnico(uuid, uuid, text, text)
  to authenticated;

-- ------------------------------------------------------------
-- 3. Bandeja de notificaciones
-- ------------------------------------------------------------
-- Una fila por aviso. Cada usuario solo ve los suyos y las
-- inserciones las hace el trigger de más abajo: la app no puede
-- crear avisos arbitrarios ni dirigidos a otra persona.
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text not null,
  incidencia_id uuid references public.incidencias (id) on delete cascade,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

-- El tipo de aviso se define con un CHECK, y un CHECK no se amplía: hay que
-- quitar el anterior y ponerlo otro. Por eso empieza con el `drop`, que
-- además deja el script reejecutable.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in (
    'reporte_nuevo',
    'asignacion',
    'reasignado',
    'resuelto',
    'mensaje_final',
    'reapertura'
  ));

alter table public.notificaciones enable row level security;

create index if not exists notificaciones_destinatario_idx
  on public.notificaciones (destinatario_id, created_at desc);

-- Solo se indexan las no leídas, que son las que cuenta la campanita.
create index if not exists notificaciones_no_leidas_idx
  on public.notificaciones (destinatario_id)
  where leida = false;

drop policy if exists "leer mis notificaciones" on public.notificaciones;
create policy "leer mis notificaciones"
  on public.notificaciones for select
  using (destinatario_id = auth.uid());

-- El UPDATE existe solo para marcar como leída. La segunda cláusula
-- impide que el cliente se cambie el destinatario o el contenido.
drop policy if exists "marcar mis notificaciones" on public.notificaciones;
create policy "marcar mis notificaciones"
  on public.notificaciones for update
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- ------------------------------------------------------------
-- 4. Creación de las notificaciones
-- ------------------------------------------------------------
-- notificar() es la única vía de INSERT. Al ser "security definer"
-- ignora RLS, que es justo lo que hace falta, y evita el problema de
-- "el aviso se guardó pero el cambio de estado falló": al estar
-- dentro del mismo trigger, es una sola operación atómica.
create or replace function public.notificar(
  p_destinatario uuid,
  p_tipo text,
  p_titulo text,
  p_cuerpo text,
  p_incidencia uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_destinatario is null then
    return;
  end if;

  -- Si ya hay un aviso igual, sin leer y muy reciente, no se repite.
  -- Sin esto, guardar el informe dos veces seguidas dejaría dos
  -- avisos idénticos en la bandeja del ciudadano.
  if exists (
    select 1
    from public.notificaciones n
    where n.destinatario_id = p_destinatario
      and n.tipo = p_tipo
      and n.incidencia_id is not distinct from p_incidencia
      and n.leida = false
      -- El intervalo va en inglés: el parser de interval de Postgres no
      -- está localizado y '10 minutos' daría error al insertar el aviso.
      and n.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;

  insert into public.notificaciones
    (destinatario_id, tipo, titulo, cuerpo, incidencia_id)
  values
    (p_destinatario, p_tipo, left(p_titulo, 120),
     left(p_cuerpo, 400), p_incidencia);
end;
$$;

-- Se avisa a todos los administradores cuando entra un reporte nuevo.
create or replace function public.trg_notificar_reporte_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  for v_admin in
    select pr.id from public.profiles pr where pr.role = 'Administrador'
  loop
    perform public.notificar(
      v_admin.id,
      'reporte_nuevo',
      'Nuevo reporte de la ciudadanía',
      'Se recibió el reporte "' || left(new.title, 80) || '" en '
        || left(new.place, 60) || '.',
      new.id
    );
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_aviso_reporte_nuevo on public.incidencias;
create trigger trg_aviso_reporte_nuevo
  after insert on public.incidencias
  for each row execute function public.trg_notificar_reporte_nuevo();

-- Cambios sobre un reporte que ya existe: reasignación, resolución y
-- mensaje de cierre del técnico.
create or replace function public.trg_notificar_incidencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tecnico text;
  v_admin record;
  v_cuerpo text;
  v_cambio_tecnico boolean := new.tecnico_id is distinct from old.tecnico_id;
  v_resuelto boolean :=
    new.status = 'Resuelto' and old.status is distinct from new.status;
  v_mensaje boolean :=
    new.mensaje_final is distinct from old.mensaje_final
    and new.mensaje_final is not null;
  -- Reapertura del ciudadano: el caso vuelve a la cola del municipio.
  v_reapertura boolean :=
    old.status = 'Resuelto' and new.status = 'Pendiente';
begin
  -- 1) Asignación, reasignación o retirada de técnico.
  if v_cambio_tecnico and new.user_id is not null then
    if new.tecnico_id is not null then
      v_tecnico := coalesce(new.tecnico_nombre, 'otro técnico');

      perform public.notificar(
        new.tecnico_id,
        'asignacion',
        'Se te asignó un reporte',
        'Te asignaron el reporte "' || left(new.title, 80) || '" en '
          || left(new.place, 60) || '.',
        new.id
      );

      -- Al ciudadano solo se le avisa si hubo un cambio de verdad: en
      -- la primera asignación no hay nada que contarle todavía.
      if old.tecnico_id is not null then
        perform public.notificar(
          new.user_id,
          'reasignado',
          'Tu reporte cambió de técnico',
          'El reporte "' || left(new.title, 80) || '" ahora lo atiende '
            || v_tecnico || '.',
          new.id
        );
      end if;
    else
      perform public.notificar(
        new.user_id,
        'reasignado',
        'Tu reporte quedó sin técnico',
        'El municipio está buscando un técnico para el reporte "'
          || left(new.title, 80) || '".',
        new.id
      );
    end if;
  end if;

  -- 2) Reporte resuelto. Si el mensaje del técnico viene en el mismo
  --    guardado, se mete dentro del mismo aviso en vez de generar dos
  --    casi idénticos.
  if v_resuelto and new.user_id is not null then
    v_cuerpo :=
      'La incidencia "' || left(new.title, 80) || '" ya fue atendida.';

    if v_mensaje then
      v_cuerpo := v_cuerpo || ' El técnico escribió: '
        || left(btrim(new.mensaje_final), 200);
    end if;

    perform public.notificar(
      new.user_id,
      'resuelto',
      'Tu reporte fue resuelto',
      v_cuerpo,
      new.id
    );
  elsif v_mensaje and new.user_id is not null then
    perform public.notificar(
      new.user_id,
      'mensaje_final',
      'El técnico te escribió',
      'Sobre el reporte "' || left(new.title, 80) || '": '
        || left(btrim(new.mensaje_final), 200),
      new.id
    );
  end if;

  -- 3) Reapertura. Va a todos los administradores, igual que un reporte
  --    nuevo: es trabajo que acaba de entrar en su cola y hay que verlo. El
  --    motivo va dentro del aviso porque sin él no hay forma de saber qué
  --    revisar.
  if v_reapertura then
    v_cuerpo := 'El ciudadano reabrió el reporte "'
      || left(new.title, 80) || '" en ' || left(new.place, 60) || '.';

    if nullif(btrim(coalesce(new.reapertura_motivo, '')), '') is not null then
      v_cuerpo := v_cuerpo || ' Dice: '
        || left(btrim(new.reapertura_motivo), 200);
    end if;

    for v_admin in
      select pr.id from public.profiles pr where pr.role = 'Administrador'
    loop
      perform public.notificar(
        v_admin.id,
        'reapertura',
        'Un ciudadano reabrió su reporte',
        v_cuerpo,
        new.id
      );
    end loop;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_aviso_incidencia on public.incidencias;
create trigger trg_aviso_incidencia
  after update on public.incidencias
  for each row execute function public.trg_notificar_incidencia();

-- ------------------------------------------------------------
-- 5. Comprobación final
-- ------------------------------------------------------------
-- Los NOTICE salen en el panel de mensajes del SQL Editor y dicen si
-- algo quedó fuera.
do $$
declare
  v_tecnicos int;
  v_admins int;
  v_select int;
begin
  select count(*) into v_tecnicos
    from public.profiles where role = 'Técnico';
  select count(*) into v_admins
    from public.profiles where role = 'Administrador';
  select count(*) into v_select
    from pg_policies
    where tablename = 'incidencias' and cmd = 'SELECT';

  raise notice
    'Listo. Técnicos: % · Administradores: % · Políticas SELECT en incidencias: %',
    v_tecnicos, v_admins, v_select;

  if v_select = 0 then
    raise warning
      'No hay ninguna política SELECT en incidencias: el administrador no verá reportes.';
  end if;

  if v_tecnicos = 0 then
    raise warning
      'No hay técnicos con rol Técnico: ejecuta primero tecnicos.sql.';
  end if;
end;
$$;
