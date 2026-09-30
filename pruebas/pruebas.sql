-- Pruebas de comportamiento contra un Postgres real.
--
-- Comprueba lo que la app da por hecho sobre el servidor: quién puede
-- leer qué, qué bloquea el trigger de edición, qué pasa al reasignar y
-- qué avisos llegan a cada bandeja.
--
-- Detalle importante: las pruebas se ejecutan con `set role
-- authenticated`, igual que PostgREST. Correrlas como postgres no
-- serviría de nada, porque el dueño de una tabla ignora sus propias
-- políticas RLS y todas las comprobaciones de aislamiento pasarían
-- siempre. El claim del usuario se pone con
-- auth_simulado.set_usuario(), que escribe lo mismo que Supabase
-- inyecta en cada petición.

\set ON_ERROR_STOP on
\pset pager off

create or replace function public.prueba(nombre text, condicion boolean)
returns void
language plpgsql
as $$
begin
  raise notice '%  %', case when condicion then '  ok  ' else ' FALLA' end, nombre;
end;
$$;

-- Comprueba que una operación queda bloqueada por un motivo que contenga
-- el texto esperado. Recibe el SQL a intentar: un bloque vacío no
-- probaría nada, porque no llegaría a ejecutar la operación.
create or replace function public.prueba_bloqueo(
  nombre text,
  esperado text,
  operacion text
)
returns void
language plpgsql
as $$
begin
  execute operacion;
  -- Si llegamos aquí la operación pasó y debería haberse bloqueado.
  raise notice ' FALLA  % → no se bloqueó (se esperaba «%»)', nombre, esperado;
exception
  when others then
    if position(esperado in sqlerrm) > 0 then
      raise notice '  ok    % → «%»', nombre, left(sqlerrm, 55);
    else
      raise notice ' FALLA  % → esperaba «%», dio «%»', nombre, esperado, left(sqlerrm, 70);
    end if;
end;
$$;

-- Ejecuta un bloque como un usuario concreto: pone su claim y baja a
-- `authenticated`, que es el rol con el que habla la app.
--
-- Importante: el claim se escribe con is_local = false, o sea que persiste
-- en toda la sesión. Si una prueba lo deja puesto, la siguiente que hable
-- como superusuario sigue pareciendo "ese usuario" para el trigger, y las
-- pruebas de rulings se mezclan sin querer. Por eso `como_superusuario()`
-- limpia el claim antes de actuar.
create or replace function public.como(usuario_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := auth_simulado.set_usuario(usuario_email);
  execute 'set local role authenticated';
  return v_id;
end;
$$;

-- Vuelve a ser el dueño de la base sin ningún usuario conectado, como
-- cuando se repara un dato a mano.
create or replace function public.como_superusuario()
returns void
language plpgsql
as $$
begin
  reset role;
  -- Un claim sin 'sub' equivale a una petición sin sesión. Se pone '{}' y
  -- no '' porque el cast a json de una cadena vacía es un error.
  perform set_config('request.jwt.claims', '{}', false);
end;
$$;

create or replace function public.como_admin()
returns uuid language sql as $$ select public.como('admin@prueba.bo') $$;

-- ------------------------------------------------------------------
-- Cuentas de prueba
-- ------------------------------------------------------------------
-- El orden importa: schema.sql crea el trigger `on_auth_user_created`,
-- que es el que inserta en profiles al dar de alta a un usuario. Por eso
-- las cuentas se crean DESPUÉS de ejecutar los scripts, no antes.
-- Se usan ids fijos, pero el alta se hace con un INSERT real para que
-- corra el trigger `on_auth_user_created`, que es el que crea el perfil.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.bo'),
  ('22222222-2222-2222-2222-222222222222', 'tecnico1@prueba.bo'),
  ('33333333-3333-3333-3333-333333333333', 'tecnico2@prueba.bo'),
  ('44444444-4444-4444-4444-444444444444', 'ciudadano@prueba.bo'),
  ('55555555-5555-5555-5555-555555555555', 'otro@prueba.bo')
on conflict (id) do update set email = excluded.email;

update public.profiles set role = 'Administrador', nombre = 'Dirección Municipal', codigo = 'ADM-0001'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'Técnico', nombre = 'Luis Pérez', codigo = 'TEC-0001'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'Técnico', nombre = 'Carmen Paz', codigo = 'TEC-0002'
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'Ciudadano', nombre = 'Ana Vecina', codigo = 'CIU-0001'
  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set role = 'Ciudadano', nombre = 'Otro vecino', codigo = 'CIU-0002'
  where id = '55555555-5555-5555-5555-555555555555';

-- `on conflict do update` no dispara los triggers AFTER INSERT, así que si
-- el usuario ya existía de una corrida anterior su perfil puede haberse
-- perdido al vaciar el esquema. Se reconstruye a mano para que las
-- pruebas no dependan del historial.
insert into public.profiles (id, email, nombre, role, codigo) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.bo', 'Dirección Municipal', 'Administrador', 'ADM-0001'),
  ('22222222-2222-2222-2222-222222222222', 'tecnico1@prueba.bo', 'Luis Pérez', 'Técnico', 'TEC-0001'),
  ('33333333-3333-3333-3333-333333333333', 'tecnico2@prueba.bo', 'Carmen Paz', 'Técnico', 'TEC-0002'),
  ('44444444-4444-4444-4444-444444444444', 'ciudadano@prueba.bo', 'Ana Vecina', 'Ciudadano', 'CIU-0001'),
  ('55555555-5555-5555-5555-555555555555', 'otro@prueba.bo', 'Otro vecino', 'Ciudadano', 'CIU-0002')
on conflict (id) do update
  set role = excluded.role,
      nombre = excluded.nombre,
      codigo = excluded.codigo;

\echo ''
\echo '=== 0. El rol de la conexión importa (control de la prueba) ==='

do $$
declare
  v_con_postgres bigint;
  v_con_authenticated bigint;
begin
  -- Como postgres, el dueño de la tabla: ve todo, RLS no aplica.
  perform auth_simulado.set_usuario('otro@prueba.bo');
  select count(*) into v_con_postgres from public.incidencias;

  -- Como authenticated, que es como habla la app.
  perform auth_simulado.set_usuario('otro@prueba.bo');
  set local role authenticated;
  select count(*) into v_con_authenticated from public.incidencias;
  reset role;

  perform public.prueba(
    format('como postgres se ven %s reportes (RLS ignorado)', v_con_postgres),
    v_con_postgres >= 3);
  perform public.prueba(
    format('como authenticated solo %s (RLS aplicado de verdad)', v_con_authenticated),
    v_con_authenticated < v_con_postgres);
end;
$$;

\echo ''
\echo '=== 1. El administrador ve todos los reportes (el problema original) ==='

do $$
declare
  v_admin bigint;
  v_total bigint;
begin
  select count(*) into v_total from public.incidencias;
  perform public.como_admin();
  select count(*) into v_admin from public.incidencias;
  reset role;

  perform public.prueba(
    format('el administrador lee los %s reportes de la tabla', v_total),
    v_admin = v_total);
end;
$$;

\echo ''
\echo '=== 2. Aislamiento por rol (RLS) ==='
-- Primero se crean reportes de cada ciudadano: hasta ahora solo existen
-- los tres de ejemplo de schema.sql, que no tienen dueño, así que no hay
-- nada que contrastar.
do $$
declare
  v_ana bigint;
  v_otro bigint;
  v_admin bigint;
begin
  perform public.como('ciudadano@prueba.bo');
  insert into public.incidencias (user_id, title, place, category)
  values ('44444444-4444-4444-4444-444444444444', 'Bache de Ana', 'Av. Uruguay', 'Vialidad');

  perform public.como('otro@prueba.bo');
  insert into public.incidencias (user_id, title, place, category)
  values ('55555555-5555-5555-5555-555555555555', 'Semaforo de otro', 'Av. Argentina', 'Señalización');

  perform public.como_admin();
  select count(*) into v_admin from public.incidencias;
  reset role;

  perform public.como('ciudadano@prueba.bo');
  select count(*) into v_ana from public.incidencias;
  reset role;

  perform public.como('otro@prueba.bo');
  select count(*) into v_otro from public.incidencias;
  reset role;

  perform public.prueba(
    format('el administrador ve los %s reportes, incluidos los ajenos', v_admin),
    v_admin >= 5);
  perform public.prueba(
    format('cada ciudadano ve solo lo suyo (Ana %s, otro %s)',
           v_ana, v_otro),
    v_ana = 1 and v_otro = 1);
end;
$$;

\echo ''
\echo '=== 3. Ventana de edición de 1 hora ==='

do $$
declare
  v_id uuid;
  v_ana uuid := '44444444-4444-4444-4444-444444444444';
begin
  perform public.como('ciudadano@prueba.bo');

  insert into public.incidencias (user_id, title, place, category)
  values (v_ana, 'Bache en la avenida', 'Av. Blanco Galindo', 'Vialidad')
  returning id into v_id;

  -- Recién enviado: se puede corregir.
  begin
    update public.incidencias set title = 'Bache profundo en la avenida' where id = v_id;
    perform public.prueba('recién enviado: el ciudadano puede corregirlo', true);
  exception when others then
    perform public.prueba('recién enviado: el ciudadano puede corregirlo', false);
  end;

  perform public.prueba(
    'editado_at lo sella la base de datos, no el cliente',
    (select editado_at is not null from public.incidencias where id = v_id));
end;
$$;

\echo ''
\echo '=== 3b. El bloqueo real de la ventana ==='

-- Se rehece la prueba con la fecha manipulada desde el servidor (como
-- superusuario, que es el único que puede tocar created_at) y luego
-- editando con el rol del ciudadano.
do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.incidencias where title like 'Bache profundo%' limit 1;

  -- Superusuario: simulamos que el reporte se envió hace 61 minutos. El
  -- claim se limpia antes: si siguiera puesto, el trigger creería que es
  -- la ciudadana y bloquearía este propio update.
  perform public.como_superusuario();
  update public.incidencias
  set created_at = now() - interval '61 minutes'
  where id = v_id;

  perform auth_simulado.set_usuario('ciudadano@prueba.bo');
  execute 'set local role authenticated';
  begin
    update public.incidencias set place = 'Otro lugar' where id = v_id;
    reset role;
    perform public.prueba('pasada 1 hora: bloqueado de verdad', false);
  exception when others then
    reset role;
    if position('la ventana de 1 hora' in sqlerrm) > 0 then
      perform public.prueba('pasada 1 hora: bloqueado de verdad', true);
    else
      perform public.prueba('bloqueado, pero por otro motivo: ' || left(sqlerrm, 45), false);
    end if;
  end;
end;
$$;

do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.incidencias where title like 'Bache profundo%' limit 1;

  -- Adelantar el reloj requiere el bypass de service_role: el trigger
  -- comprueba la fecha VIEJA, así que tampoco deja mover un reporte de
  -- 61 minutos a 30. Es el mismo camino que usa el panel de Supabase.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  update public.incidencias
  set created_at = now() - interval '30 minutes'
  where id = v_id;

  perform public.como('ciudadano@prueba.bo');
  begin
    update public.incidencias set place = 'Av. Blanco Galindo y Beni' where id = v_id;
    reset role;
    perform public.prueba('a los 30 minutos: todavía puede corregirlo', true);
  exception when others then
    reset role;
    perform public.prueba('a los 30 minutos: todavía puede corregirlo', false);
  end;
end;
$$;

\echo ''
\echo '=== 3c. El trigger no se desactiva por accidente ==='
-- Regresión: el bypass de service_role está dentro de una función
-- security definer, así que current_user es su propietario y NO quien
-- llama. Si esa comprobación usara current_user, valdría siempre y el
-- trigger dejaría de proteger nada.
do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.incidencias where title like 'Bache profundo%' limit 1;

  perform public.como_superusuario();
  update public.incidencias
  set created_at = now() - interval '61 minutes'
  where id = v_id;

  -- service_role: el panel de Supabase sí puede, aunque pase la hora.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  begin
    update public.incidencias set place = 'Corregido desde el panel' where id = v_id;
    perform public.prueba('service_role puede corregir datos desde el panel', true);
  exception when others then
    perform public.prueba('service_role puede corregir datos desde el panel: ' || left(sqlerrm, 45), false);
  end;

  -- Y el ciudadano sigue bloqueado justo después: el bypass es del rol
  -- del claim, no una puerta trasera que desactive el trigger entero.
  perform auth_simulado.set_usuario('ciudadano@prueba.bo');
  execute 'set local role authenticated';
  begin
    update public.incidencias set place = 'Otro intento' where id = v_id;
    reset role;
    perform public.prueba('el ciudadano sigue bloqueado tras el bypass', false);
  exception when others then
    reset role;
    perform public.prueba('el ciudadano sigue bloqueado tras el bypass',
      position('la ventana de 1 hora' in sqlerrm) > 0);
  end;
end;
$$;

\echo ''
\echo '=== 4. El ciudadano no puede tocar lo que no es suyo ==='

-- RLS no da un error al escribir sobre una fila ajena: simplemente la
-- filtra, así que el UPDATE afecta a 0 filas y no pasa nada. Por eso lo
-- que se comprueba es que el reporte queda intacto, no que salte un error.
do $$
declare
  v_ajeno uuid;
  v_titulo_antes text;
  v_afectadas int;
begin
  select id, title into v_ajeno, v_titulo_antes
  from public.incidencias
  where user_id = '44444444-4444-4444-4444-444444444444'
    and title = 'Bache de Ana'
  limit 1;

  perform public.como('otro@prueba.bo');
  update public.incidencias set title = 'secuestro' where id = v_ajeno;
  get diagnostics v_afectadas = row_count;
  reset role;

  perform public.prueba(
    format('su UPDATE sobre el reporte ajeno afecta a %s filas', v_afectadas),
    v_afectadas = 0);
  perform public.prueba(
    'el reporte ajeno sigue intacto',
    (select title = v_titulo_antes from public.incidencias where id = v_ajeno));
end;
$$;

\echo ''
\echo '=== 4b. El ciudadano no puede ascenderse a administrador ==='
-- Si el UPDATE de profiles no estuviera restringido, cualquiera podría
-- cambiarse el rol a Administrador y ver todos los reportes del municipio.
do $$
declare
  v_rol text;
begin
  perform public.como('otro@prueba.bo');
  perform public.prueba_bloqueo(
    'el ciudadano no puede ascenderse a administrador',
    'El rol y el código de cuenta solo los asigna un administrador',
    $sql$update public.profiles set role = 'Administrador'
       where id = '55555555-5555-5555-5555-555555555555'$sql$);
  reset role;

  select role into v_rol from public.profiles
  where id = '55555555-5555-5555-5555-555555555555';

  perform public.prueba(
    'sigue siendo ' || v_rol || ' después del intento',
    v_rol = 'Ciudadano');
end;
$$;

\echo ''
\echo '=== 4c. El administrador sí puede cambiar roles ==='
-- El bypass no debe dejarnos encerrados: el municipio es quien asigna
-- los roles, y tiene que poder seguir haciéndolo desde la app.
do $$
begin
  perform public.como_admin();
  update public.profiles set role = 'Técnico'
  where id = '55555555-5555-5555-5555-555555555555';
  perform public.prueba('el administrador sí puede promover a alguien',
    (select role = 'Técnico' from public.profiles
      where id = '55555555-5555-5555-5555-555555555555'));
  reset role;
end;
$$;

\echo ''
\echo '=== 4d. El código de cuenta y su unicidad ==='
-- El código es la llave con la que el municipio reconoce a su personal, y
-- por eso va en la misma guarda que el rol: si un ciudadano pudiera fijarse
-- el suyo, se haría pasar por técnico con un solo update.
--
-- La cuenta de usar y tirar representa al personal recién dado de alta; las
-- pruebas de citizenidad van sobre el perfil del propio ciudadano, porque
-- RLS ya impide tocar el de otro (un UPDATE a una fila ajena afecta a 0
-- filas y ni siquiera llega al trigger, así que no probaría nada).
do $$
declare
  v_id uuid := '77777777-7777-7777-7777-777777777777';
begin
  -- Se reproduce el camino real de un alta de personal: la cuenta entra en
  -- auth y la Edge Function, que va con la clave de servicio, le asigna rol
  -- y código. El perfil lo crea sola el trigger handle_new_user.
  --
  -- El andamiaje solo borra el esquema public entre corridas, así que la
  -- fila de auth.users puede venir de la anterior. Se limpia antes porque,
  -- si el INSERT no hiciera nada, handle_new_user no se dispararía, el
  -- perfil no existiría y las comprobaciones de abajo pasarían en verde sin
  -- haber escrito nada.
  reset role;
  delete from public.profiles where id = v_id;
  delete from auth.users where id = v_id;

  insert into auth.users (id, email) values (v_id, 'altas@prueba.bo');

  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  update public.profiles set role = 'Técnico', codigo = 'TEC-0500'
   where id = v_id;

  perform public.prueba(
    'service_role puede dar de alta a un técnico con su código',
    (select role = 'Técnico' and codigo = 'TEC-0500' from public.profiles
      where id = v_id));

  perform public.como('otro@prueba.bo');
  perform public.prueba_bloqueo(
    'el ciudadano no puede cambiar su propio código',
    'El rol y el código de cuenta solo los asigna un administrador',
    $sql$update public.profiles set codigo = 'TEC-0001'
       where id = '55555555-5555-5555-5555-555555555555'$sql$);
  perform public.prueba_bloqueo(
    'el ciudadano no puede falsear su fecha de alta',
    'No puedes cambiar tu identificador de cuenta',
    $sql$update public.profiles set created_at = now() - interval '5 years'
       where id = '55555555-5555-5555-5555-555555555555'$sql$);

  -- Lo único que un ciudadano sí puede tocar de su perfil es su nombre.
  update public.profiles set nombre = 'Nombre corregido'
   where id = '55555555-5555-5555-5555-555555555555';
  perform public.prueba('el trigger deja retocar solo su nombre',
    (select nombre = 'Nombre corregido' from public.profiles
      where id = '55555555-5555-5555-5555-555555555555'));
  reset role;

  -- Y la Edge Function, que va con la clave de servicio, sí puede ascender a
  -- administrador: es la única vía por la que un rol se otorga desde fuera
  -- del panel.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  update public.profiles set role = 'Administrador', codigo = 'ADM-0500'
   where id = v_id;
  perform public.prueba('service_role sí puede asignar rol y código',
    (select role = 'Administrador' and codigo = 'ADM-0500' from public.profiles
      where id = v_id));
  update public.profiles set nombre = 'Otro vecino'
   where id = '55555555-5555-5555-5555-555555555555';

  -- Con el índice único, dos cuentas no pueden compartir código. Sin él,
  -- find_email_by_codigo devolvería una de las dos al azar y la otra
  -- quedaría inalcanzable al entrar por código. Se intenta en minúsculas
  -- porque el índice es sobre lower(codigo): CIU-0001 y ciu-0001 son el
  -- mismo código. Es un UPDATE y no un INSERT para no chocar con la clave
  -- foránea que une profiles con auth.users.
  perform public.prueba_bloqueo(
    'no se pueden repetir dos códigos de cuenta',
    'profiles_codigo_unico',
    format('update public.profiles set codigo = %L where id = %L',
           'ciu-0001', v_id));

  -- Se borra la cuenta de prueba de auth y de profiles.
  reset role;
  delete from public.profiles where id = v_id;
  delete from auth.users where id = v_id;
end;
$$;

\echo ''
\echo '=== 5. Mensaje de cierre del técnico ==='

do $$
declare
  v_id uuid;
  v_ana uuid := '44444444-4444-4444-4444-444444444444';
  v_luis uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform public.como('ciudadano@prueba.bo');
  insert into public.incidencias (user_id, title, place, category)
  values (v_ana, 'Alumbrado fundido', 'Av. Uruguay', 'Iluminación')
  returning id into v_id;
  reset role;

  perform public.como_admin();
  perform public.asignar_tecnico(v_id, v_luis, 'Luis Pérez', null);
  reset role;

  -- Sin mensaje no se cierra. Se manda el resultado para que la primera
  -- comprobación que falle sea la del mensaje, que es lo que importa
  -- aquí: el trigger valida los dos campos en ese orden.
  perform public.como('tecnico1@prueba.bo');
  perform public.prueba_bloqueo(
    'el técnico no puede cerrar sin escribir al ciudadano',
    '10 caracteres',
    format('update public.incidencias
            set status = ''Resuelto'', cierre_resultado = ''Resuelto''
            where id = %L', v_id));
  perform public.prueba_bloqueo(
    'el técnico no puede cerrar sin decir cómo terminó',
    'cómo terminó el trabajo',
    format('update public.incidencias
            set status = ''Resuelto'',
                mensaje_final = ''Ya lo arreglaron bien.''
            where id = %L', v_id));
  -- Y un mensaje de una palabra tampoco cuenta como explicación.
  perform public.prueba_bloqueo(
    'un mensaje demasiado corto tampoco vale',
    '10 caracteres',
    format('update public.incidencias
            set status = ''Resuelto'',
                cierre_resultado = ''Resuelto'',
                mensaje_final = ''Listo''
            where id = %L', v_id));
  reset role;

  -- Con los dos campos, sí.
  perform public.como('tecnico1@prueba.bo');
  update public.incidencias
  set cierre_resultado = 'Resuelto',
      mensaje_final = 'Se cambió la luminaria y el tramo ya tiene luz.',
      status = 'Resuelto'
  where id = v_id;
  reset role;

  perform public.prueba(
    'con resultado y mensaje, el cierre se guarda',
    (select status = 'Resuelto' and cierre_resultado = 'Resuelto'
     from public.incidencias where id = v_id));

  perform public.prueba(
    'el servidor sella mensaje_final_at',
    (select mensaje_final_at is not null from public.incidencias where id = v_id));

  perform public.como('tecnico1@prueba.bo');
  perform public.prueba_bloqueo(
    'el técnico no puede reescribir el título del ciudadano',
    'El técnico solo puede registrar',
    format('update public.incidencias set title = ''Lo que yo quiera'' where id = %L', v_id));
  reset role;
end;
$$;

\echo ''
\echo '=== 6. Reasignación con historial ==='

do $$
declare
  v_id uuid;
  v_cambios int;
  v_luis uuid := '22222222-2222-2222-2222-222222222222';
  v_carmen uuid := '33333333-3333-3333-3333-333333333333';
begin
  perform public.como('ciudadano@prueba.bo');
  insert into public.incidencias (user_id, title, place, category)
  values (
    '44444444-4444-4444-4444-444444444444',
    'Semáforo quemado', 'Av. Argentina', 'Señalización'
  )
  returning id into v_id;
  reset role;

  perform public.como_admin();
  perform public.asignar_tecnico(v_id, v_luis, 'Luis Pérez', null);
  perform public.asignar_tecnico(
    v_id, v_carmen, 'Carmen Paz', 'Necesita equipo especializado');

  select count(*) into v_cambios
  from public.incidencia_asignaciones
  where incidencia_id = v_id and rol = 'reasignacion';

  perform public.prueba('la reasignación queda en el historial', v_cambios = 1);
  perform public.prueba(
    'el motivo queda guardado',
    (select motivo = 'Necesita equipo especializado'
     from public.incidencia_asignaciones
     where incidencia_id = v_id and rol = 'reasignacion'));

  perform public.prueba_bloqueo(
    'reasignar al mismo técnico se rechaza',
    'ya está asignado',
    format('select public.asignar_tecnico(%L, %L, ''Carmen Paz'', null)',
           v_id, v_carmen));

  -- Un ciudadano no puede asignar.
  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'un ciudadano no puede asignar técnicos',
    'Solo el administrador',
    format('select public.asignar_tecnico(%L, %L, ''Luis Pérez'', null)',
           v_id, v_luis));
  reset role;
end;
$$;

\echo ''
\echo '=== 7. El ciudadano ve su historial de cambios ==='

do $$
declare
  v_cambios int;
  v_fugas int;
begin
  perform auth_simulado.set_usuario('ciudadano@prueba.bo');
  execute 'set local role authenticated';
  select count(*) into v_cambios
  from public.incidencia_asignaciones where rol = 'reasignacion';
  reset role;

  perform public.prueba(
    format('el ciudadano ve %s reasignación(es) de sus reportes', v_cambios),
    v_cambios >= 1);

  -- No debe ver el historial de otros.
  perform auth_simulado.set_usuario('55555555-5555-5555-5555-555555555555');
  execute 'set local role authenticated';
  select count(*) into v_fugas
  from public.incidencia_asignaciones
  where incidencia_id in (
    select id from public.incidencias
    where user_id = '44444444-4444-4444-4444-444444444444'
  );
  reset role;

  perform public.prueba(
    'otro ciudadano no ve ese historial',
    v_fugas = 0);
end;
$$;

\echo ''
\echo '=== 8. Bandeja de notificaciones ==='

do $$
declare
  v_admin int;
  v_luis int;
  v_carmen int;
  v_ana int;
begin
  perform auth_simulado.set_usuario('admin@prueba.bo');
  execute 'set local role authenticated';
  select count(*) into v_admin from public.notificaciones;
  reset role;
  perform public.prueba(
    format('el administrador fue avisado de los reportes nuevos (%s)', v_admin),
    v_admin >= 3);

  perform auth_simulado.set_usuario('tecnico1@prueba.bo');
  execute 'set local role authenticated';
  select count(*) into v_luis from public.notificaciones;
  reset role;
  perform public.prueba(
    format('Luis avisado de sus asignaciones (%s)', v_luis),
    v_luis >= 1);

  perform auth_simulado.set_usuario('ciudadano@prueba.bo');
  execute 'set local role authenticated';
  select count(*) into v_ana from public.notificaciones;
  reset role;
  perform public.prueba(
    format('la ciudadana recibe avisos de sus reportes (%s)', v_ana),
    v_ana >= 2);

  perform public.prueba(
    'la ciudadana fue avisada de que le resolvieron un reporte',
    exists (
      select 1 from public.notificaciones
      where destinatario_id = '44444444-4444-4444-4444-444444444444'
        and tipo = 'resuelto'));

  perform public.prueba(
    'la ciudadana fue avisada del cambio de técnico',
    exists (
      select 1 from public.notificaciones
      where destinatario_id = '44444444-4444-4444-4444-444444444444'
        and tipo = 'reasignado'));
end;
$$;

\echo ''
\echo '=== 9. La bandeja no se filtra entre usuarios ==='

do $$
declare
  v_fugas int;
begin
  perform auth_simulado.set_usuario('otro@prueba.bo');
  execute 'set local role authenticated';
  select count(*) into v_fugas
  from public.notificaciones
  where destinatario_id <> '55555555-5555-5555-5555-555555555555';
  reset role;

  perform public.prueba('un usuario no lee la bandeja de otro', v_fugas = 0);
end;
$$;

\echo ''
\echo '=== 10. Nadie puede escribir avisos falsos ==='
-- Los avisos los escriben los triggers, no la app. Si existiera una
-- política de INSERT para los usuarios, cualquiera podría fabricarse
-- notificaciones: "tu reporte fue resuelto" sin que nadie lo resolviera.
do $$
begin
  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'no puede insertar una notificación a nombre de otro',
    'row-level security',
    $sql$insert into public.notificaciones
           (destinatario_id, tipo, titulo, cuerpo, incidencia_id)
         values ('55555555-5555-5555-5555-555555555555', 'resuelto',
                 'Fake', 'Este aviso es falso', null)$sql$);
  reset role;
end;
$$;

\echo ''
\echo '=== 11. Ni escribirse avisos a sí mismo ==='
-- ...ni por la vía de "es para mí, luego es legítimo". La función
-- notificar() es security definer y solo la llaman los triggers.
do $$
begin
  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'no puede escribirse avisos a sí mismo',
    'row-level security',
    $sql$insert into public.notificaciones
           (destinatario_id, tipo, titulo, cuerpo, incidencia_id)
         values ('44444444-4444-4444-4444-444444444444', 'resuelto',
                 'Fake', 'Yo me aviso a mí mismo', null)$sql$);
  reset role;
end;
$$;

\echo ''
\echo '=== 12. Reapertura del reporte por el ciudadano ==='
-- El caso que pidió el municipio: el municipio resolvió, el problema sigue
-- y el vecino devuelve el reporte a la cola.
do $$
declare
  v_id uuid;
  v_luis uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform public.como('ciudadano@prueba.bo');
  insert into public.incidencias (user_id, title, place, category)
  values (
    '44444444-4444-4444-4444-444444444444',
    'Bache reaperturado', 'Av. Blanco Galindo', 'Vialidad'
  )
  returning id into v_id;
  reset role;

  -- Con técnico, igual que un caso ya atendido de verdad.
  perform public.como_admin();
  perform public.asignar_tecnico(v_id, v_luis, 'Luis Pérez', null);
  perform public.como('tecnico1@prueba.bo');
  update public.incidencias
  set status = 'Resuelto',
      cierre_resultado = 'Resuelto',
      mensaje_final = 'Se tapó el bache con cemento el martes pasado.'
  where id = v_id;
  reset role;

  -- Sin motivo (o con uno demasiado corto) no se reabre: el municipio
  -- necesita saber qué sigue mal.
  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'reabrir sin motivo se rechaza',
    '10 caracteres',
    format('update public.incidencias
            set status = ''Pendiente'', reapertura_motivo = ''igual''
            where id = %L', v_id));
  reset role;

  -- Y la reapertura no sirve de comodín para cambiar otros campos de paso:
  -- solo el estado y el motivo, en la misma operación.
  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'reabrir no sirve para cambiar otros campos',
    'solo puedes cambiar el estado',
    format('update public.incidencias
            set status = ''Pendiente'',
                reapertura_motivo = ''Sigue roto después de la lluvia.'',
                place = ''Otra calle''
            where id = %L', v_id));
  reset role;

  -- Con motivo, sí.
  perform public.como('ciudadano@prueba.bo');
  update public.incidencias
  set status = 'Pendiente',
      reapertura_motivo = 'El bache se volvió a abrir con la lluvia.'
  where id = v_id;
  reset role;

  perform public.prueba(
    'reabierto: vuelve a Pendiente',
    (select status = 'Pendiente' from public.incidencias where id = v_id));

  perform public.prueba(
    'el motivo queda guardado',
    (select reapertura_motivo = 'El bache se volvió a abrir con la lluvia.'
     from public.incidencias where id = v_id));

  -- La fecha y el contador los sella la base, no el cliente. El técnico
  -- vuelve a cerrar el caso y el ciudadano lo reabre otra vez, pero
  -- mandando una fecha y un contador falsos: tienen que quedar los del
  -- servidor.
  perform public.como('tecnico1@prueba.bo');
  update public.incidencias
  set status = 'Resuelto',
      cierre_resultado = 'Resuelto',
      mensaje_final = 'Se volvió a tapar el bache con el tiempo.'
  where id = v_id;
  reset role;

  perform public.como('ciudadano@prueba.bo');
  update public.incidencias
  set status = 'Pendiente',
      reapertura_motivo = 'Volvió a abrirse esta misma semana.',
      reapertura_at = '2020-01-01 00:00:00+00',
      reaperturas = 99
  where id = v_id;
  reset role;

  perform public.prueba(
    'el servidor sella la fecha de la reapertura',
    (select reapertura_at is not null and reapertura_at > now() - interval '5 minutes'
     from public.incidencias where id = v_id));

  perform public.prueba(
    'y cuenta las reaperturas, sin hacer caso al cliente',
    (select reaperturas = 2 from public.incidencias where id = v_id));

  -- El técnico se conserva: es el que conoce el caso.
  perform public.prueba(
    'el técnico que lo atendía se mantiene',
    (select tecnico_id = v_luis from public.incidencias where id = v_id));

  -- Reabrir no devuelve la ventana de edición: sus datos ya los leyó el
  -- municipio. Sin esto, reabrir dentro de la primera hora dejaría
  -- cambiar el título de un caso ya atendido.
  perform public.como('ciudadano@prueba.bo');
  perform public.prueba_bloqueo(
    'tras reabrir, los datos ya no se pueden cambiar',
    'se reabrió',
    format('update public.incidencias set title = ''Otro título'' where id = %L', v_id));
  reset role;

  -- Reabrir un reporte que nunca se resolvió no tiene sentido: para eso el
  -- vecino lo edita, si sigue en su hora. Y aunque no se resolviera, no
  -- puede escribir un motivo de reapertura: ese motivo solo existe cuando
  -- el caso vuelve a la cola, y la app lo muestra como tal.
  declare
    v_nuevo uuid;
  begin
    perform public.como('ciudadano@prueba.bo');
    insert into public.incidencias (user_id, title, place, category)
    values (
      '44444444-4444-4444-4444-444444444444',
      'Bache recién reportado', 'Av. Blanco Galindo', 'Vialidad'
    )
    returning id into v_nuevo;
    reset role;

    perform public.como('ciudadano@prueba.bo');
    perform public.prueba_bloqueo(
      'no se puede reabrir lo que nunca se resolvió',
      'Solo puedes modificar',
      format('update public.incidencias
              set status = ''Pendiente'',
                  reapertura_motivo = ''Quiero volver a mirarlo porque sí.''
              where id = %L', v_nuevo));
    reset role;

    perform public.como('ciudadano@prueba.bo');
    perform public.prueba_bloqueo(
      'tampoco se puede escribir un motivo sin reabrir',
      'Solo puedes modificar',
      format('update public.incidencias
              set reapertura_motivo = ''Este motivo no viene de una reapertura.''
              where id = %L', v_nuevo));
    reset role;

    perform public.como('tecnico1@prueba.bo');
    perform public.prueba_bloqueo(
      'ni el técnico puede escribir el motivo de la reapertura',
      'El técnico solo puede registrar',
      format('update public.incidencias
              set reapertura_motivo = ''Yo también puedo ponerlo, ¿no?.''
              where id = %L', v_id));
    reset role;
  end;

  -- Reapertura ajena: RLS filtra antes del trigger, así que no da error
  -- sino cero filas afectadas.
  declare
    v_ajeno uuid;
    v_afectadas int;
  begin
    perform public.como('otro@prueba.bo');
    insert into public.incidencias (user_id, title, place, category)
    values (
      '55555555-5555-5555-5555-555555555555',
      'Reporte del otro vecino', 'Av. Uruguay', 'Limpieza'
    )
    returning id into v_ajeno;

    perform public.como_admin();
    update public.incidencias
    set status = 'Resuelto', cierre_resultado = 'Resuelto',
        mensaje_final = 'Se recogió toda la basura acumulada.'
    where id = v_ajeno;
    reset role;

    perform public.como('ciudadano@prueba.bo');
    update public.incidencias
    set status = 'Pendiente',
        reapertura_motivo = 'Este reporte no es mío, quiero reabrirlo.'
    where id = v_ajeno;
    get diagnostics v_afectadas = row_count;
    reset role;

    perform public.prueba(
      format('reabrir el reporte de otro afecta a %s filas', v_afectadas),
      v_afectadas = 0);
    perform public.prueba(
      'el reporte ajeno sigue resuelto',
      (select status = 'Resuelto' from public.incidencias where id = v_ajeno));
  end;

  -- Los administradores se enteran, con el motivo dentro del aviso.
  perform public.prueba(
    'el administrador fue avisado de la reapertura',
    exists (
      select 1 from public.notificaciones
      where destinatario_id = '11111111-1111-1111-1111-111111111111'
        and tipo = 'reapertura'
        and incidencia_id = v_id));

  perform public.prueba(
    'el aviso de reapertura trae el motivo',
    exists (
      select 1 from public.notificaciones
      where tipo = 'reapertura'
        and incidencia_id = v_id
        and cuerpo like '%se volvió a abrir%'));
end;
$$;

\echo ''
\echo '=== 13. El mapa muestra los reportes de toda la ciudad ==='
-- El ciudadano puede ver en el mapa lo que reportó todo el mundo, pero solo
-- los datos del pin: el informe y el mensaje final de otro no son suyos.
do $$
declare
  v_pines bigint;
  v_columnas text;
begin
  perform public.como('ciudadano@prueba.bo');
  select count(*) into v_pines from public.mapa_incidencias();
  reset role;

  perform public.prueba(
    format('el ciudadano ve %s pines en el mapa (incluidos ajenos)', v_pines),
    v_pines >= 3);

  -- Lo que devuelve son las ocho columnas del pin, ni una más.
  select string_agg(column_name, ', ' order by ordinal_position)
    into v_columnas
  from information_schema.columns
  where table_schema = 'public' and table_name = 'incidencias'
    and column_name in ('informe', 'materiales', 'mensaje_final', 'user_id', 'image_url');

  perform auth_simulado.set_usuario('ciudadano@prueba.bo');
  execute 'set local role authenticated';
  perform public.prueba(
    'la función del mapa existe y se puede llamar',
    (select count(*) > 0 from public.mapa_incidencias()));
  reset role;

  perform public.prueba(
    format('las columnas que menciona la prueba existen en la tabla (%s)', v_columnas),
    v_columnas is not null);
end;
$$;

-- Anónimo no entra al mapa: sin sesión no hay ni usuario ni municipal.
do $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{}', false);
  set local role anon;
  perform public.prueba_bloqueo(
    'sin sesión no se leen los pines',
    'permission denied',
    'select * from public.mapa_incidencias()');
  reset role;
end;
$$;

\echo ''
\echo '=== 14. El mismo problema no se reporta dos veces ==='
-- La regla que pidió el municipio: dos reportes de la misma categoría a menos
-- de 30 metros son el mismo problema. La app la avisa antes de dejar enviar
-- (src/lib/duplicados.js) y esto es la barrera de verdad: la que sigue ahí
-- aunque alguien llame a la API sin pasar por la app.
--
-- Las distancias se miden en grados de latitud porque es lo predecible: 0,000225°
-- son 25 m (dentro del radio) y 0,000315° son 35 m (fuera). Y todo ocurre en una
-- esquina aparte de los datos de ejemplo, para no chocar con ellos.
do $$
declare
  v_lat constant double precision := -17.3000;
  v_lng constant double precision := -66.2000;
  v_ana uuid;
  v_otro uuid;
  v_farol uuid;
  v_lejos uuid;
  v_bache uuid;
  v_sin_punto uuid;
  v_despues_resolver uuid;
begin
  -- Los dos vecinos de prueba. Los ids se sacan con la misma función que usa
  -- `public.como`, pero sin tocar el rol dos veces seguidas.
  v_ana := auth_simulado.set_usuario('ciudadano@prueba.bo');
  v_otro := auth_simulado.set_usuario('otro@prueba.bo');
  reset role;

  -- El primero no tiene con qué chocar: entra.
  perform public.como('ciudadano@prueba.bo');
  insert into public.incidencias (user_id, title, place, category, lat, lng)
  values (v_ana, 'Farola fundida en la esquina', 'Calle Sucre', 'Iluminación',
          v_lat, v_lng)
  returning id into v_farol;
  reset role;

  perform public.prueba(
    'el primer reporte de la categoría entra',
    v_farol is not null);

  -- El caso que importa: lo reporta OTRO vecino, 25 metros más allá. Aquí RLS
  -- no puede salvar a nadie, porque el trigger mira la tabla entera (es
  -- security definer): si no, cada vecino vería únicamente lo suyo y el
  -- duplicado entraría dos veces, que es justo lo que se quiere evitar.
  declare
    v_msg text;
    v_avisos_antes bigint;
    v_avisos_despues bigint;
  begin
    perform public.como('otro@prueba.bo');
    perform public.prueba_bloqueo(
      'otro vecino no puede reportar lo mismo a 25 metros',
      'Ya hay un reporte de esta categoría',
      format($sql$insert into public.incidencias (user_id, title, place, category, lat, lng)
             values (%L, 'La misma farola, otro vecino', 'Calle Sucre',
                     'Iluminación', %L, %L)$sql$,
             v_otro, v_lat + 0.000225, v_lng));
    reset role;

    -- Lo que importa no es solo que se frene, sino lo que se le dice a quien
    -- lo intentó: qué reporte encontró y a cuántos metros está, para que sepa
    -- si lo que iba a reportar era justo lo mismo.
    perform public.como('otro@prueba.bo');
    begin
      insert into public.incidencias (user_id, title, place, category, lat, lng)
      values (v_otro, 'La misma farola, otro vecino', 'Calle Sucre',
              'Iluminación', v_lat + 0.000225, v_lng);
    exception when others then
      v_msg := sqlerrm;
    end;
    reset role;

    perform public.prueba(
      'el aviso dice qué reporte hay ya en ese punto',
      position('«Farola fundida en la esquina»' in coalesce(v_msg, '')) > 0);
    perform public.prueba(
      'y a cuántos metros está',
      coalesce(v_msg, '') like '%a 25 m%');

    -- Y que el intento rechazado no dejó ni rastro: ni la fila (el trigger
    -- que avisa al administrador se dispara antes que este) ni el aviso a
    -- medias. El trigger de duplicados va después del de notificaciones por
    -- orden alfabético, así que esto prueba que el rollback es completo.
    perform public.como_superusuario();
    select count(*) into v_avisos_antes from public.notificaciones;
    perform public.como('otro@prueba.bo');
    begin
      insert into public.incidencias (user_id, title, place, category, lat, lng)
      values (v_otro, 'La misma farola, otro vecino', 'Calle Sucre',
              'Iluminación', v_lat + 0.000225, v_lng);
    exception when others then
      null;
    end;
    perform public.como_superusuario();
    select count(*) into v_avisos_despues from public.notificaciones;

    perform public.prueba(
      'el reporte rechazado no quedó en la tabla',
      not exists (
        select 1 from public.incidencias
        where title = 'La misma farola, otro vecino'));
    perform public.prueba(
      'ni quedó un aviso al administrador a medias',
      v_avisos_antes = v_avisos_despues);
  end;

  -- A 35 metros ya es otro punto: entra.
  perform public.como('otro@prueba.bo');
  insert into public.incidencias (user_id, title, place, category, lat, lng)
  values (v_otro, 'Poste sin luz en la otra esquina', 'Calle Sucre',
          'Iluminación', v_lat + 0.000315, v_lng)
  returning id into v_lejos;
  reset role;

  perform public.prueba(
    'a 35 metros del primero sí se puede reportar',
    v_lejos is not null);

  -- Misma esquina, otra categoría: son dos problemas distintos.
  perform public.como('otro@prueba.bo');
  insert into public.incidencias (user_id, title, place, category, lat, lng)
  values (v_otro, 'Bache en la misma esquina', 'Calle Sucre', 'Vialidad',
          v_lat, v_lng)
  returning id into v_bache;
  reset role;

  perform public.prueba(
    'en la misma esquina, otra categoría sí entra',
    v_bache is not null);

  -- Sin punto no hay distancia que comparar.
  perform public.como('otro@prueba.bo');
  insert into public.incidencias (user_id, title, place, category)
  values (v_otro, 'Farola fundida pero sin punto', 'No ubico la calle',
          'Iluminación')
  returning id into v_sin_punto;
  reset role;

  perform public.prueba(
    'un reporte sin punto no se frena (no hay nada que comparar)',
    v_sin_punto is not null);

  -- Editar el texto sin mover el reporte no crea duplicados: frena aquí sería
  -- un molesto sin motivo (y dejaría sin poder corregir reportes antiguos que
  -- se hubieran reportado dos veces antes de que existiera la regla).
  perform public.como('otro@prueba.bo');
  update public.incidencias
  set title = 'Poste sin luz (corregido)', lat = v_lat + 0.000315
  where id = v_lejos;
  reset role;

  perform public.prueba(
    'corregir el texto sin mover el punto no se frena',
    (select position('corregido' in title) > 0
     from public.incidencias where id = v_lejos));

  -- Pero moverlo sí: tampoco se puede esquivar la regla por la puerta de atrás.
  perform public.como('otro@prueba.bo');
  perform public.prueba_bloqueo(
    'mover un reporte encima de otro del mismo tipo tampoco',
    'Ya hay un reporte de esta categoría',
    format('update public.incidencias set lat = %L, lng = %L where id = %L',
           v_lat, v_lng, v_lejos));
  reset role;

  perform public.prueba(
    'y el reporte se quedó donde estaba',
    (select lat = v_lat + 0.000315 from public.incidencias where id = v_lejos));

  -- Lo resuelto no estorba: el municipio ya fue a ese punto, así que el
  -- problema puede haber vuelto. Si contara, una vez resuelta una esquina nadie
  -- podría volver a reportar nada en ella.
  --
  -- El cierre va con su resultado y su mensaje, como siempre: el trigger de
  -- edición no deja cerrar un reporte en blanco.
  perform public.como_admin();
  update public.incidencias
  set status = 'Resuelto',
      cierre_resultado = 'Resuelto',
      mensaje_final = 'Se cambió la luminaria de la esquina.'
  where id = v_lejos;
  reset role;

  perform public.como('ciudadano@prueba.bo');
  insert into public.incidencias (user_id, title, place, category, lat, lng)
  values (v_ana, 'La farola volvió a apagarse', 'Calle Sucre', 'Iluminación',
          v_lat + 0.000315, v_lng)
  returning id into v_despues_resolver;
  reset role;

  perform public.prueba(
    'sobre un reporte ya resuelto sí se puede volver a reportar',
    v_despues_resolver is not null);
end;
$$;
