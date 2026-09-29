-- Comprobación de que los scripts se pueden volver a ejecutar.
--
-- En Supabase es normal que haya que correr un script otra vez (se
-- corrigió algo, o se toca la base de un proyecto ya en marcha). Si eso
-- falla a mitad de camino se quedan objetos a medias, así que conviene
-- comprobarlo: se ejecuta todo dos veces seguidas y luego se repite la
-- batería de comportamiento para ver que sigue funcionando igual.

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo '################  SEGUNDA EJECUCIÓN DE LOS SCRIPTS  ################'

\echo '--- schema.sql (2ª vez) ---'
\o /dev/null
\i supabase/schema.sql
\o
\echo '  ok · schema.sql'

\echo '--- notificaciones.sql (2ª vez) ---'
\o /dev/null
\i supabase/notificaciones.sql
\o
\echo '  ok · notificaciones.sql'

\echo '--- tecnicos.sql (2ª vez) ---'
\o /dev/null
\i supabase/tecnicos.sql
\o
\echo '  ok · tecnicos.sql'

\echo ''
\echo '################  LOS DATOS SIGUEN EN PIE  ################'

do $$
declare
  v_incidencias bigint;
  v_notificaciones bigint;
  v_asignaciones bigint;
  v_perfiles bigint;
  v_policies int;
  v_triggers int;
begin
  select count(*) into v_incidencias from public.incidencias;
  select count(*) into v_notificaciones from public.notificaciones;
  select count(*) into v_asignaciones from public.incidencia_asignaciones;
  select count(*) into v_perfiles from public.profiles;
  select count(*) into v_policies from pg_policies
    where schemaname = 'public';
  select count(*) into v_triggers from pg_trigger
    where not tgisinternal;

  perform public.prueba(
    format('siguen los %s reportes', v_incidencias), v_incidencias > 0);
  perform public.prueba(
    format('siguen los %s avisos', v_notificaciones), v_notificaciones > 0);
  perform public.prueba(
    format('sigue el historial con %s asignaciones', v_asignaciones), v_asignaciones > 0);
  perform public.prueba(
    format('siguen los %s perfiles', v_perfiles), v_perfiles > 0);
  perform public.prueba(
    format('no se duplicaron políticas (%s en total)', v_policies), v_policies > 0);
  perform public.prueba(
    format('no se duplicaron triggers (%s en total)', v_triggers), v_triggers > 0);
end;
$$;

\echo ''
\echo '################  LAS REGLAS SIGUEN VIGENTES  ################'

-- Lo importante de reejecutar no es solo que no falle: es que los
-- triggers sigan protegiendo. Si una segunda pasada dejara un trigger
-- sin replacing, estas dos pruebas lo delatarían.
do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.incidencias where title like 'Bache profundo%' limit 1;

  -- Se aginga la fecha con service_role y luego se intenta editar como
  -- el ciudadano: tiene que seguir bloqueado.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  update public.incidencias
  set created_at = now() - interval '61 minutes'
  where id = v_id;

  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'tras reejecutar, la ventana de 1 hora sigue vigente',
    'la ventana de 1 hora',
    format('update public.incidencias set place = ''Otro'' where id = %L', v_id));
  perform public.prueba_bloqueo(
    'tras reejecutar, el rol sigue protegido',
    'El rol y el código de cuenta solo los asigna un administrador',
    $sql$update public.profiles set role = 'Administrador'
       where id = '44444444-4444-4444-4444-444444444444'$sql$);
  perform public.prueba_bloqueo(
    'tras reejecutar, el código de cuenta sigue protegido',
    'El rol y el código de cuenta solo los asigna un administrador',
    $sql$update public.profiles set codigo = 'TEC-0001'
       where id = '44444444-4444-4444-4444-444444444444'$sql$);
  reset role;
end;
$$;

\echo ''
\echo '################  LAS FUNCIONES SIGUEN EXPORTADAS  ################'
-- La app llama a estos nombres por RPC. Si una reejecución los hubiera
-- borrado o renombrado, la app dejaría de funcionar sin que se note
-- hasta que alguien pulse un botón.

do $$
declare
  v_falta text;
begin
  foreach v_falta in array array[
    'asignar_tecnico', 'is_admin', 'notificar', 'puede_ver_asignacion'
  ] loop
    perform public.prueba(
      format('la función %s existe', v_falta),
      exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = v_falta
      ));
  end loop;
end;
$$;

do $$
begin
  perform public.prueba(
    'existe la restricción incidencias_coordenadas_check',
    exists (
      select 1
      from pg_constraint
      where conname = 'incidencias_coordenadas_check'
    ));
end;
$$;
