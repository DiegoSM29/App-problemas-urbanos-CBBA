// Cliente único de Supabase para toda la app.
// Usa las variables del .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY).
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY en tu .env'
  );
}

export const SUPABASE_URL = url;
export const supabase = createClient(url, key);