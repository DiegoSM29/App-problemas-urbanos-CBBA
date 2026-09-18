import { supabase, hasSupabase } from './supabase';

export async function getSessionUser() {
  if (!hasSupabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function fetchProfile(userId) {
  if (!hasSupabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!hasSupabase)
    throw new Error(
      'Supabase no está configurado. Revisa .env con tus credenciales.'
    );
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signUp(email, password, role, nombre) {
  if (!hasSupabase)
    throw new Error(
      'Supabase no está configurado. Revisa .env con tus credenciales.'
    );
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre: nombre ?? null } },
  });
  if (error) throw error;
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { id: data.user.id, email, role, nombre: nombre ?? null },
        { onConflict: 'id' }
      );
    if (profileError) throw profileError;
  }
  return data.user;
}

export async function signOut() {
  if (!hasSupabase) return;
  await supabase.auth.signOut();
}