// Autenticación contra Supabase Auth.
// El rol NO se elige al entrar: sale del perfil (tabla public.profiles).
// Permite entrar con correo o con el código de cuenta (CBA-1001, ADM-0001, …).
//
// Hay dos altas distintas y deliberadamente separadas:
//
//   · Ciudadano → se registra solo con signUp. El rol no se manda desde aquí
//     porque no se elige: el trigger handle_new_user de la base de datos
//     escribe siempre 'Ciudadano'.
//   · Técnico y
//     Administrador → los crea el administrador con createAccount, que delega
//     en la Edge Function admin-create-user.

import { supabase } from '../lib/supabase';

// Roles que el administrador puede dar de alta. 'Ciudadano' no aparece a
// propósito: los ciudadanos se registran solos.
export const STAFF_ROLES = ['Administrador', 'Técnico'];

const CREATE_ACCOUNT_FUNCTION = 'admin-create-user';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nombre, role, codigo, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

function looksLikeEmail(value) {
  return String(value ?? '').includes('@');
}

// Resuelve "código o correo" a un email real. Los códigos se resuelven con
// la función RPC find_email_by_codigo (security definer, funciona sin sesión).
export async function resolveEmail(identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return null;
  if (looksLikeEmail(value)) return value.toLowerCase();
  const { data, error } = await supabase.rpc('find_email_by_codigo', {
    p_codigo: value,
  });
  if (error || !data) return null;
  return data;
}

export async function signIn(identifier, password) {
  const email = await resolveEmail(identifier);
  if (!email) {
    throw new Error(
      'El código o correo no corresponde a ninguna cuenta registrada.'
    );
  }
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error(
        'El código o correo y la contraseña no coinciden con ninguna cuenta creada.'
      );
    }
    throw new Error(error.message);
  }
  const session = await getSession();
  return session?.user ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ------------------------------------------------------------
// Alta de ciudadanos (autoregistro)
// ------------------------------------------------------------

// Registra a un ciudadano. No acepta rol a propósito: la base de datos se
// encarga de dejar el perfil como 'Ciudadano' pase lo que pase con los
// metadatos que envía la app.
export async function signUp({ nombre, email, password }) {
  const correo = String(email ?? '').trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password,
    options: {
      data: { nombre: String(nombre ?? '').trim() },
    },
  });

  if (error) {
    if (/already registered|already been registered|user already/i.test(error.message)) {
      throw new Error('Ese correo ya tiene una cuenta. Prueba a iniciar sesión.');
    }
    throw new Error(error.message);
  }

  // Si el proyecto tiene activa la confirmación de correo, signUp NO devuelve
  // sesión: el ciudadano recién creado todavía no puede entrar. Si está
  // desactivada, entra directo. Por eso se avisa en vez de asumir nada.
  return { needsEmailConfirmation: !data?.session };
}

// ------------------------------------------------------------
// Alta de personal (Técnico / Administrador) hecha por el admin
// ------------------------------------------------------------

// Las funciones de Supabase devuelven los errores con dos formas distintas
// según sea un fallo de red o una respuesta con cuerpo, así que aquí se
// traducen las dos a un mensaje entendible.
async function functionErrorMessage(error) {
  const context = error?.context;

  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      // Respuesta sin cuerpo JSON: se cae al mensaje genérico de abajo.
    }
  } else if (context && typeof context === 'object' && context.error) {
    return String(context.error);
  }

  if (/fetch failed|failed to fetch|network|load failed/i.test(error?.message ?? '')) {
    return 'No se pudo contactar al servidor. Revisa tu conexión a internet.';
  }

  return (
    'No se pudo crear la cuenta. Si eres administrador, verifica que la ' +
    'función admin-create-user esté desplegada: ' +
    'supabase functions deploy admin-create-user'
  );
}

// Crea la cuenta de un técnico o administrador desde la pantalla "Personal".
// La validación real (quién llama, si es admin) ocurre dentro de la Edge
// Function, que además es la única que tiene la clave de servicio.
export async function createAccount({ nombre, email, role, password, codigo }) {
  if (!STAFF_ROLES.includes(role)) {
    throw new Error(
      'Los ciudadanos se registran solos en la app. Aquí solo se crea personal.'
    );
  }

  const { data, error } = await supabase.functions.invoke(CREATE_ACCOUNT_FUNCTION, {
    body: {
      nombre: String(nombre ?? '').trim(),
      email: String(email ?? '').trim().toLowerCase(),
      role,
      password,
      codigo: String(codigo ?? '').trim().toUpperCase() || null,
    },
  });

  if (error) throw new Error(await functionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));

  return data;
}

// Listado de cuentas de personal. La política "admin lee perfiles" deja pasar
// solo a los administradores, así que cualquier otro recibiría cero filas.
export async function fetchAccounts() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, email, role, codigo, created_at')
    .in('role', STAFF_ROLES)
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}