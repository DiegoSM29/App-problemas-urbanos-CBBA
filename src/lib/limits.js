// Límites de la app. Se usan en los formularios (para avisar al usuario) y
// se replican como restricciones en la base de datos (supabase/schema.sql)
// para que ningún cliente se los pueda saltar.

// Máximo de caracteres por campo de texto.
export const LIMITS = {
  title: 120,
  place: 100,
  informe: 200,
  materiales: 300,
};

// Peso máximo de una imagen: 15 MB.
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

// Mensajes reutilizables.
export const IMAGE_TOO_LARGE_MESSAGE = `La imagen supera los ${MAX_IMAGE_MB} MB. Elige una más liviana.`;

export function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Recorta a "max" caracteres y deja un aviso con lo que falta.
export function limitText(text, max) {
  const value = String(text ?? '');
  if (value.length <= max) return null;
  return `Máximo ${max} caracteres (te faltan ${value.length - max}).`;
}
