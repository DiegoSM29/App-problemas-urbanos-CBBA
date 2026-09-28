// ============================================================
// Edge Function: admin-create-user
// ============================================================
//
// Da de alta las cuentas de Técnico y Administrador que crea el
// administrador desde la app (pantalla "Personal").
//
// ¿Por qué una Edge Function y no una llamada normal?
//
// Crear usuarios en Supabase Auth requiere la clave de servicio
// (SUPABASE_SERVICE_ROLE_KEY), y esa clave NO puede ir dentro de la app:
// viaja en el teléfono de cada usuario y concede acceso total a la base de
// datos. La clave de servicio solo puede existir en un servidor, y el único
// servidor que este proyecto tiene es la Edge Function.
//
// Aquí dentro, en cambio, se usa para una sola cosa y siempre después de
// comprobar quién está llamando.
//
// La Edge Function NO es una puerta abierta: `verify_jwt` valida la firma
// del token y, además, el primer paso es mirar el perfil de quien llama y
// exigir que sea Administrador. Aunque alguien descubriera esta URL, sin
// una sesión de administrador no puede hacer nada.
//
// Para desplegarla (una sola vez, o cada vez que cambie este archivo):
//
//   supabase login
//   supabase link --project-ref <tu-ref-de-proyecto>
//   supabase functions deploy admin-create-user
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Roles que el administrador puede crear. 'Ciudadano' NO está en la lista a
// propósito: los ciudadanos se registran solos desde la app y el rol se lo
// pone la base de datos, no una persona.
const ALLOWED_ROLES = ['Administrador', 'Técnico'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODIGO_RE = /^[A-Z]{2,4}-[0-9]{1,5}$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Siguiente código libre del tipo TEC-0008 / ADM-0002, para que el
// administrador no tenga que inventarlos a mano.
async function siguienteCodigo(
  admin: ReturnType<typeof createClient>,
  role: string,
): Promise<string> {
  const prefijo = role === 'Técnico' ? 'TEC' : 'ADM';

  const { data } = await admin
    .from('profiles')
    .select('codigo')
    .like('codigo', `${prefijo}-%`);

  let mayor = 0;
  for (const fila of data ?? []) {
    const numero = Number(String(fila.codigo).split('-')[1]);
    if (Number.isFinite(numero) && numero > mayor) mayor = numero;
  }

  return `${prefijo}-${String(mayor + 1).padStart(4, '0')}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey || !serviceKey) {
    return json({ error: 'La función no tiene sus credenciales configuradas.' }, 500);
  }

  // ---- 1. Quién está llamando -------------------------------------------
  const token = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return json({ error: 'Debes iniciar sesión.' }, 401);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData?.user) {
    return json({ error: 'Tu sesión venció. Vuelve a iniciar sesión.' }, 401);
  }

  // ---- 2. Solo administradores ------------------------------------------
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: perfil } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (perfil?.role !== 'Administrador') {
    return json(
      { error: 'Solo un administrador puede crear cuentas de personal.' },
      403,
    );
  }

  // ---- 3. Datos del alta -------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'No se recibieron los datos de la cuenta.' }, 400);
  }

  const email = String(payload.email ?? '').trim().toLowerCase();
  const nombre = String(payload.nombre ?? '').trim();
  const password = String(payload.password ?? '');
  const role = String(payload.role ?? '').trim();
  const codigoPedido = String(payload.codigo ?? '').trim().toUpperCase();

  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Escribe un correo electrónico válido.' }, 400);
  }
  if (nombre.length < 3) {
    return json({ error: 'Escribe el nombre completo (mínimo 3 letras).' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json(
      {
        error:
          'Ese rol no se puede crear desde aquí. Los ciudadanos se registran ' +
          'solos en la app.',
      },
      400,
    );
  }
  if (codigoPedido && !CODIGO_RE.test(codigoPedido)) {
    return json(
      { error: 'El código debe tener el formato TEC-0001 o ADM-0001.' },
      400,
    );
  }

  const codigo = codigoPedido || (await siguienteCodigo(admin, role));

  // Se comprueba con limit(1) en vez de maybeSingle() a propósito: si la base
  // tiene códigos repetidos de antes de crear el índice único, maybeSingle()
  // fallaría con "se encontraron varias filas" y dejaría al administrador sin
  // poder crear personal. Con limit(1) simplemente se avisa del conflicto.
  const { data: ocupados } = await admin
    .from('profiles')
    .select('id')
    .ilike('codigo', codigo)
    .limit(1);

  if (ocupados?.length) {
    return json(
      { error: `El código ${codigo} ya está asignado a otra cuenta.` },
      409,
    );
  }

  // ---- 4. Cuenta en Supabase Auth ---------------------------------------
  // email_confirm: true porque el personal se la crea el municipio, no se
  // registra solo: no tiene sentido pedirle que vaya a su correo a confirmar.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (createError || !created?.user) {
    const mensaje = createError?.message ?? '';
    if (/already been registered|already exists|duplicate/i.test(mensaje)) {
      return json({ error: 'Ya existe una cuenta con ese correo.' }, 409);
    }
    return json(
      { error: `No se pudo crear la cuenta: ${mensaje || 'error desconocido'}` },
      400,
    );
  }

  // ---- 5. Rol y código en el perfil -------------------------------------
  // El trigger handle_new_user ya dejó el perfil como 'Ciudadano'; aquí se le
  // da el rol real. Se usa upsert y no update para que la cuenta quede bien
  // aunque el perfil no existiera (base nueva, o trigger sin ejecutar). Esta
  // escritura va con la clave de servicio, que es justo lo que el trigger
  // trg_proteger_perfil le permite hacer.
  const { error: perfilError } = await admin
    .from('profiles')
    .upsert({ id: created.user.id, email, nombre, role, codigo });

  if (perfilError) {
    // No se deja una cuenta a medio crear, sin rol y sin poder entrar bien.
    await admin.auth.admin.deleteUser(created.user.id);
    return json(
      {
        error:
          'Se creó la cuenta pero no se pudo asignar el rol, así que se ' +
          `deshizo. Detalle: ${perfilError.message}`,
      },
      500,
    );
  }

  return json({ ok: true, id: created.user.id, email, nombre, role, codigo });
});
