// Autenticación contra Supabase Auth.
// El rol NO se elige al entrar: sale del perfil (tabla public.profiles).
// Permite entrar con correo o con el código de cuenta (CBA-1001, ADM-0001, …).

import { supabase } from '../lib/supabase';

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

// Cuentas de ejemplo que se muestran en la pantalla de inicio de sesión.
export const exampleAccounts = [
  {
    role: 'Administrador',
    nombre: 'María Fernández',
    codigo: 'ADM-0001',
    email: 'admin@demo.bo',
    password: 'admin123',
  },
  {
    role: 'Ciudadano',
    nombre: 'Ana Torres',
    codigo: 'CBA-1001',
    email: 'ana.torres@demo.bo',
    password: 'ciudadano123',
  },
  {
    role: 'Técnico',
    nombre: 'Carlos Mamani',
    codigo: 'TEC-0001',
    email: 'carlos.mamani@demo.bo',
    password: 'tecnico123',
  },
];