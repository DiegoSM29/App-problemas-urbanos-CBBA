-- ============================================================
-- Diagnóstico: ¿por qué el administrador no ve los reportes?
-- ============================================================
-- Ejecución: Supabase → SQL Editor → New query → Run.
--
-- Este script SOLO LEE. No cambia nada, así que se puede correr
-- las veces que haga falta sin riesgo.
--
-- Al final imprime una lista de ✓/✗ con lo que falta y, si hace
-- falta, el archivo que hay que volver a ejecutar.
-- ============================================================

with comprobaciones as (
  select
    -- ¿La seguridad por fila está activa en incidencias?
    (
      select coalesce(c.relrowsecurity, false)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relname = 'incidencias' and n.nspname = 'public'
    ) as rls_activo,

    -- ¿Existe la política que deja ver TODO al administrador?
    (
      select count(*) > 0
      from pg_policies
      where tablename = 'incidencias'
        and cmd = 'SELECT'
        and policyname = 'admin lee todas las incidencias'
    ) as politica_admin,

    -- ¿Y la del ciudadano?
    (
      select count(*) > 0
      from pg_policies
      where tablename = 'incidencias'
        and cmd = 'SELECT'
        and policyname = 'ciudadano lee sus incidencias'
    ) as politica_ciudadano,

    -- ¿Y la del técnico?
    (
      select count(*) > 0
      from pg_policies
      where tablename = 'incidencias'
        and cmd = 'SELECT'
        and policyname = 'tecnico lee sus incidencias'
    ) as politica_tecnico,

    -- ¿La función is_admin() existe? Sin ella ninguna política admin
    -- funciona, aunque la política esté escrita.
    (
      select count(*) > 0 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'is_admin' and n.nspname = 'public'
    ) as existe_is_admin,

    -- ¿Cuántos administradores hay registrados?
    (select count(*) from public.profiles where role = 'Administrador')
      as total_administradores,

    -- ¿Cuántos técnicos hay registrados?
    (select count(*) from public.profiles where role = 'Técnico')
      as total_tecnicos,

    -- ¿Hay reportes en la tabla? (sin RLS, esto ve todo)
    (select count(*) from public.incidencias) as total_reportes
)
select
  case when rls_activo then '✓' else '✗' end as ok,
  'Seguridad por fila activa en incidencias' as que,
  case
    when rls_activo then 'correcto'
    else 'FALTA → ejecuta schema.sql'
  end as resultado
from comprobaciones

union all
select
  case when existe_is_admin then '✓' else '✗' end,
  'Función is_admin() disponible',
  case when existe_is_admin then 'correcto' else 'FALTA → ejecuta schema.sql' end
from comprobaciones

union all
select
  case when politica_admin then '✓' else '✗' end,
  'Política que muestra todos los reportes al administrador',
  case
    when politica_admin then 'correcto'
    else 'FALTA → ejecuta schema.sql (esta es la causa más común del problema)'
  end
from comprobaciones

union all
select
  case when politica_ciudadano then '✓' else '✗' end,
  'Política que muestra al ciudadano sus propios reportes',
  case when politica_ciudadano then 'correcto' else 'FALTA → ejecuta schema.sql' end
from comprobaciones

union all
select
  case when politica_tecnico then '✓' else '✗' end,
  'Política que muestra al técnico sus asignaciones',
  case when politica_tecnico then 'correcto' else 'FALTA → ejecuta schema.sql' end
from comprobaciones

union all
select
  case when total_administradores > 0 then '✓' else '✗' end,
  'Existe al menos un Administrador (' || total_administradores || ')',
  case
    when total_administradores > 0 then 'correcto'
    else 'FALTA → cambia el rol de tu cuenta a Administrador'
  end
from comprobaciones

union all
select
  case when total_tecnicos > 0 then '✓' else '✗' end,
  'Existe al menos un Técnico (' || total_tecnicos || ')',
  case
    when total_tecnicos > 0 then 'correcto'
    else 'FALTA → ejecuta tecnicos.sql'
  end
from comprobaciones

union all
select
  case when total_reportes > 0 then '✓' else '✗' end,
  'Hay reportes en la base de datos (' || total_reportes || ')',
  case
    when total_reportes > 0 then 'correcto'
    else 'No hay nada que mostrar todavía: envía un reporte como ciudadano'
  end
from comprobaciones

union all
select
  case
    when (select count(*) from pg_tables
           where schemaname = 'public'
             and tablename = 'notificaciones') > 0
    then '✓' else '·'
  end,
  'Tabla de notificaciones instalada',
  case
    when (select count(*) from pg_tables
           where schemaname = 'public'
             and tablename = 'notificaciones') > 0
    then 'correcto'
    else 'aún no → ejecuta notificaciones.sql'
  end

union all
select
  case
    when (select count(*) from pg_tables
           where schemaname = 'public'
             and tablename = 'incidencia_asignaciones') > 0
    then '✓' else '·'
  end,
  'Tabla de historial de asignaciones instalada',
  case
    when (select count(*) from pg_tables
           where schemaname = 'public'
             and tablename = 'incidencia_asignaciones') > 0
    then 'correcto'
    else 'aún no → ejecuta notificaciones.sql'
  end

union all
-- Sin este RPC el administrador no puede asignar técnicos, y el error que
-- devuelve la API ("Could not find the function ... in the schema cache")
-- no dice que falta este script.
select
  case when (select count(*) > 0 from pg_proc
             where proname = 'asignar_tecnico') > 0
    then '✓' else '✗' end,
  'Función asignar_tecnico() disponible',
  case when (select count(*) > 0 from pg_proc
             where proname = 'asignar_tecnico') > 0
    then 'correcto'
    else 'FALTA → ejecuta notificaciones.sql (no puedes asignar técnicos sin ella)'
  end

union all
select
  case when (select count(*) > 0 from pg_proc
             where proname = 'puede_ver_asignacion') > 0
    then '✓' else '✗' end,
  'Función puede_ver_asignacion() disponible',
  case when (select count(*) > 0 from pg_proc
             where proname = 'puede_ver_asignacion') > 0
    then 'correcto'
    else 'FALTA → ejecuta notificaciones.sql (el historial no se vería)'
  end

union all
-- Sin esta restricción la app es el único filtro geográfico, y la app se
-- puede saltar quien llame a la API directamente.
select
  case when (select count(*) > 0 from pg_constraint
             where conname = 'incidencias_coordenadas_check') > 0
    then '✓' else '✗' end,
  'Incidencias limitadas al área de Cochabamba',
  case when (select count(*) > 0 from pg_constraint
             where conname = 'incidencias_coordenadas_check') > 0
    then 'correcto'
    else 'FALTA → ejecuta schema.sql (si antes había incidencias fuera de la ciudad, ejecuta antes el listado de abajo)'
  end

union all
-- Si este número es mayor que cero, la restricción de arriba no se pudo
-- crear: el script la omite para no abortar. Hay que decidir qué hacer con
-- esas filas.
--
-- Es la negación exacta de la comprobación del CHECK en schema.sql, para que
-- el diagnóstico y la restricción no puedan discrepar.
select
  case when (
    select count(*) from public.incidencias
    where not (
      (lat is null and lng is null)
      or (lat between -17.5 and -17.2 and lng between -66.36 and -66.0)
    )
  ) = 0 then '✓' else '✗' end,
  'Coordenadas válidas en todas las incidencias',
  case when (
    select count(*) from public.incidencias
    where not (
      (lat is null and lng is null)
      or (lat between -17.5 and -17.2 and lng between -66.36 and -66.0)
    )
  ) = 0 then 'correcto'
    else 'FALTA → revisa el listado de abajo, luego vuelve a ejecutar schema.sql'
  end;

-- ------------------------------------------------------------
-- Extra: incidencias con coordenadas que no cumplen el límite
-- ------------------------------------------------------------
-- No debería haber ninguna. Si salen, el municipio está atendiendo reportes
-- de otras ciudades (o hay filas con media coordenada). Decide si se
-- corrigen a mano o se dejan con la ubicación vacía antes de volver a
-- ejecutar schema.sql.
select
  left(title, 60) as reporte,
  place,
  lat,
  lng,
  case
    when lat is null and lng is null then 'sin ubicación (correcto)'
    when lat is null or lng is null then 'mitad de la coordenada'
    else 'fuera de Cochabamba'
  end as problema
from public.incidencias
where not (
  (lat is null and lng is null)
  or (lat between -17.5 and -17.2 and lng between -66.36 and -66.0)
)
order by created_at;

-- ------------------------------------------------------------
-- Extra: las cuentas y sus roles
-- ------------------------------------------------------------
-- Si tu cuenta no aparece como Administrador, ese es el problema.
select
  coalesce(codigo, '(sin código)') as codigo,
  nombre,
  role as rol
from public.profiles
order by
  case role
    when 'Administrador' then 1
    when 'Técnico' then 2
    else 3
  end,
  coalesce(codigo, nombre);
