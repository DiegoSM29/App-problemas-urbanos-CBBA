-- ============================================================
-- Los 7 técnicos de la municipalidad
-- ============================================================
--
-- NOTA: este script es solo para la carga inicial de los 7 técnicos de
-- demostración. A partir de la función "Alta de cuentas y roles", el
-- administrador puede crear técnicos y administradores desde la propia app
-- (pantalla "Personal"), que además valida quién puede hacerlo y genera el
-- código de acceso solo. Este script se conserva para poder volver a dejar
-- lista esa lista inicial cuando haga falta.
--
-- Ver LEEME_CUENTAS_Y_ROLES.md.
--
-- PASO 1 — Crear las cuentas en Supabase (esto el SQL NO lo puede hacer,
-- porque las contraseñas las guarda Supabase Auth cifradas):
--
--   Supabase Dashboard → Authentication → Users → "Add user"
--
--   Correo                      Contraseña
--   -------------------------   ----------------
--   carlos.mamani@demo.bo       tecnico123      (ya existe, TEC-0001)
--   luis.quispe@demo.bo         tecnico123
--   maria.lopez@demo.bo         tecnico123
--   jorge.paz@demo.bo           tecnico123
--   ana.rojas@demo.bo           tecnico123
--   diego.mercado@demo.bo       tecnico123
--   sofia.cordova@demo.bo       tecnico123
--
--   Sugerencias al crearlas:
--     · "Auto Confirm User" activado (para que puedan entrar sin verificar
--       el correo; si no, tendrías que confirmar cada uno a mano).
--     · En "User Metadata" pon:  { "nombre": "Luis Quispe" }
--       (el nombre real de cada uno, para que se vea en la app).
--
-- PASO 2 — Ejecutar este script (SQL Editor → New query → Run).
-- Busca cada usuario por correo y le asigna el rol Técnico, su nombre y su
-- código de acceso. Incluye a Carlos (TEC-0001), así que el script deja
-- siempre los 7 listos. Es seguro volver a ejecutarlo las veces que quieras.
-- ============================================================

do $$
declare
  v_tecnicos text[][] := array[
    ['carlos.mamani@demo.bo',    'Carlos Mamani',   'TEC-0001'],
    ['luis.quispe@demo.bo',      'Luis Quispe',     'TEC-0002'],
    ['maria.lopez@demo.bo',      'María López',     'TEC-0003'],
    ['jorge.paz@demo.bo',        'Jorge Paz',       'TEC-0004'],
    ['ana.rojas@demo.bo',        'Ana Rojas',       'TEC-0005'],
    ['diego.mercado@demo.bo',    'Diego Mercado',   'TEC-0006'],
    ['sofia.cordova@demo.bo',    'Sofía Córdova',   'TEC-0007']
  ];
  v_fila text[];
  v_id uuid;
begin
  foreach v_fila slice 1 in array v_tecnicos loop
    select id into v_id
    from auth.users
    where lower(email) = lower(v_fila[1]);

    if v_id is null then
      raise notice 'Falta crear la cuenta % en Authentication → Users', v_fila[1];
      continue;
    end if;

    -- El trigger on_auth_user_created ya suele crear el perfil al crear el
    -- usuario; si no existe, se inserta aquí.
    insert into public.profiles (id, email, nombre, role, codigo)
    values (v_id, v_fila[1], v_fila[2], 'Técnico', v_fila[3])
    on conflict (id) do update
      set nombre  = excluded.nombre,
          role    = 'Técnico',
          codigo  = excluded.codigo,
          email   = excluded.email;
  end loop;

  raise notice 'Listo: % técnicos listos para asignar desde el panel del admin.',
    (select count(*) from public.profiles where role = 'Técnico');
end;
$$;

-- Verificación: debe devolver 7 filas.
select nombre, email, codigo, role
from public.profiles
where role = 'Técnico'
order by codigo;
