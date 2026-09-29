-- Pruebas de lo que puede hacer el PANEL de Supabase (SQL Editor).
--
-- Estas pruebas se ejecutan en una sesión de psql aparte, y eso es lo
-- importante: el panel abre una conexión nueva en la que no existe
-- request.jwt.claims, porque no hay ninguna petición de la API detrás. La
-- batería de pruebas.sql corre en la sesión contraria, con el claim puesto,
-- que es el caso de la app.
--
-- Si el trigger que protege el perfil no distinguiera los dos casos, pasaría
-- una de estas dos cosas: o la app podría ascenderse a administradora, o
-- el propio script que crea el índice único no podría deduplicar códigos
-- antiguos. Aquí se comprueba que el panel sí puede trabajar.

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo '=== 6. El panel puede mantener los datos a mano ==='

do $$
declare
  v_rol text;
begin
  -- Sin claims, proteger_perfil debe dejar pasar el cambio: quien llega al
  -- SQL Editor ya administra la base entera.
  update public.profiles
     set nombre = 'Dirección Municipal (revisado)'
   where email = 'admin@prueba.bo';

  perform public.prueba(
    'el panel puede corregir el nombre de un administrador',
    (select nombre = 'Dirección Municipal (revisado)'
       from public.profiles where email = 'admin@prueba.bo'));

  -- Y también cambiar roles, que es la reparación típica cuando alguien se
  -- autoasignó un rol por un fallo anterior. Se localiza la cuenta por
  -- correo y no por código a propósito: el paso anterior de esta batería
  -- renombra códigos, y una prueba atada a un código concreto fallaría por
  -- el motivo equivocado. TEC-0900 está libre para que el índice único no
  -- sea lo que frene la operación.
  update public.profiles
     set role = 'Técnico', codigo = 'TEC-0900'
   where email = 'tecnico1@prueba.bo';

  select role into v_rol
    from public.profiles where email = 'tecnico1@prueba.bo';

  perform public.prueba(
    'el panel puede corregir un rol equivocado',
    v_rol = 'Técnico');
end;
$$;

\echo ''
\echo '=== 7. El script limpia códigos repetidos y crea el índice único ==='
-- Qué comprueba: si la base arrastra códigos repetidos de antes del índice,
-- reejecutar schema.sql tiene que dejarla usable (limpia los repetidos y
-- crea el índice) en vez de reventar a mitad. El paso 6b de
-- verificar-todo.sh planta los duplicados y tira el índice antes de
-- reejecutar el script; aquí se mira el resultado.

do $$
declare
  v_repetidos integer;
  v_indice text;
begin
  select count(*) into v_repetidos from (
    select lower(codigo)
      from public.profiles
     where codigo is not null
     group by lower(codigo)
    having count(*) > 1
  ) d;

  perform public.prueba(
    'no queda ningún código repetido',
    v_repetidos = 0);

  select indexname into v_indice
    from pg_indexes
   where schemaname = 'public'
     and indexname = 'profiles_codigo_unico';

  perform public.prueba(
    'el índice único de códigos quedó creado',
    v_indice = 'profiles_codigo_unico');
end;
$$;

\echo ''
\echo '=== 8. El login por código sigue resolviendo una sola cuenta ==='
do $$
declare
  v_codigo text;
  v_email text;
begin
  -- Se busca un código que exista en vez de escribir uno fijo: la limpieza
  -- de repetidos del paso anterior renombra códigos, y lo que importa aquí
  -- es que la resolución por código no distinga mayúsculas de minúsculas.
  select lower(p.codigo) into v_codigo
    from public.profiles p
   where p.codigo is not null
   order by p.codigo
   limit 1;

  select public.find_email_by_codigo(v_codigo) into v_email;

  perform public.prueba(
    'find_email_by_codigo resuelve el código en minúsculas',
    v_email = (select p.email from public.profiles p
                where lower(p.codigo) = v_codigo));
end;
$$;
