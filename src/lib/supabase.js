// Cliente único de Supabase para toda la app.
// Usa las variables del .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY).
import { createClient } from '@supabase/supabase-js';
import {
  configureProbe,
  reportFailure,
  reportSuccess,
} from './connection';

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
configureProbe(url);

// Supabase no distingue "no hay internet" de otros fallos, así que su fetch se
// envuelve para que el monitor de conexión se entere de cada petición.
const plainFetch = (...args) => globalThis.fetch(...args);

function trackedFetch(...args) {
  return plainFetch(...args).then(
    (res) => {
      reportSuccess();
      return res;
    },
    (e) => {
      reportFailure();
      throw e;
    }
  );
}

export const supabase = createClient(url, key, {
  global: { fetch: trackedFetch },
});