// Acceso a las incidencias de Supabase (tabla public.incidencias).
// Cada rol ve lo que le corresponde (RLS):
//   - Ciudadano → sus propios reportes
//   - Administrador → todos los reportes
//   - Técnico → los reportes asignados a él

import { supabase, SUPABASE_URL } from '../lib/supabase';
import { statusTone } from '../theme/colors';

export const DUPLICATE_MESSAGE =
  'Este reporte ya ha sido registrado en esta zona';

const IMAGE_BUCKET = 'incidencias';

function toneFor(status) {
  return statusTone[status] ?? 'warning';
}

function formatTime(value) {
  if (!value) return '—';
  if (typeof value === 'string' && (value.includes('/') || value.includes('Hoy')))
    return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return sameDay ? `Hoy, ${hh}:${mm}` : `${dd}/${mo}/${d.getFullYear()}`;
}

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    place: row.place,
    status: row.status,
    tone: toneFor(row.status),
    time: formatTime(row.created_at),
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    user_id: row.user_id ?? null,
    image_url: row.image_url ?? null,
    tecnico_id: row.tecnico_id ?? null,
    tecnico_nombre: row.tecnico_nombre ?? null,
    informe: row.informe ?? null,
    materiales: row.materiales ?? null,
    informe_at: row.informe_at ?? null,
  };
}

export async function fetchReports({ userId, role } = {}) {
  let query = supabase.from('incidencias').select('*');
  if (role === 'Técnico') {
    query = query.eq('tecnico_id', userId);
  } else if (role !== 'Administrador') {
    query = query.eq('user_id', userId);
  }
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchTechnicians() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, email')
    .eq('role', 'Técnico')
    .order('nombre');
  if (error) throw new Error(error.message);
  return data ?? [];
}

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function findDuplicate({ title, place, excludeId }) {
  const t = normalize(title);
  const p = normalize(place);
  if (!t || !p) return null;
  const { data, error } = await supabase
    .from('incidencias')
    .select('id, title, place');
  if (error || !data) return null;
  return (
    data.find(
      (r) =>
        r.id !== excludeId &&
        normalize(r.title) === t &&
        normalize(r.place) === p
    ) ?? null
  );
}

// ---- Imágenes en Supabase Storage ----

function base64ToBlob(base64, mime) {
  if (typeof atob === 'function' && typeof Blob !== 'undefined') {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  if (typeof Buffer !== 'undefined') {
    return new Blob([Buffer.from(base64, 'base64')], { type: mime });
  }
  throw new Error('No se pudo procesar la imagen en este dispositivo.');
}

async function uploadImage(asset) {
  const mime = asset.mimeType || asset.type || 'image/jpeg';
  const ext = String(mime.split('/')[1] || 'jpg')
    .toLowerCase()
    .replace('jpeg', 'jpg');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const isReactNative =
    typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

  let body;
  if (isReactNative && asset.uri && !String(asset.uri).startsWith('data:')) {
    // En nativo, exponer el archivo local como FormData (uri/name/type).
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || path,
      type: mime,
    });
    body = form;
  } else if (asset.base64) {
    body = base64ToBlob(asset.base64, mime);
  } else if (typeof asset.uri === 'string' && asset.uri.startsWith('data:')) {
    const match = asset.uri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Formato de imagen no soportado.');
    body = base64ToBlob(match[2], match[1] || mime);
  } else {
    return asset.uri ?? null; // ya es un archivo remoto o no hay imagen real
  }

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, body, { contentType: mime, cacheControl: '3600' });
  if (error) throw new Error(`No se pudo guardar la imagen: ${error.message}`);

  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}

// ---- Operaciones CRUD ----

export async function createReport({
  title,
  category,
  place,
  lat,
  lng,
  user_id,
  image_url,
  imageAsset,
}) {
  const duplicate = await findDuplicate({ title, place });
  if (duplicate) throw new Error(DUPLICATE_MESSAGE);

  let finalImage = image_url ?? null;
  if (imageAsset) {
    finalImage = await uploadImage(imageAsset);
  }

  const { data, error } = await supabase
    .from('incidencias')
    .insert({
      user_id: user_id ?? null,
      title,
      category,
      place,
      status: 'Pendiente',
      lat: lat ?? null,
      lng: lng ?? null,
      image_url: finalImage,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateReportStatus(id, status) {
  const { error } = await supabase.from('incidencias').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function assignTechnician(id, tecnicoId, tecnicoNombre) {
  const { error } = await supabase
    .from('incidencias')
    .update({ tecnico_id: tecnicoId, tecnico_nombre: tecnicoNombre })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function completeReport(id, { informe, materiales, status }) {
  const { error } = await supabase
    .from('incidencias')
    .update({
      informe,
      materiales,
      status: status ?? undefined,
      informe_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}