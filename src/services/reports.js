// Acceso a las incidencias de Supabase (tabla public.incidencias).
// Cada rol ve lo que le corresponde (RLS):
//   - Ciudadano → sus propios reportes
//   - Administrador → todos los reportes
//   - Técnico → los reportes asignados a él

import { supabase, SUPABASE_URL } from '../lib/supabase';
import { statusTone } from '../theme/colors';
import {
  LIMITS,
  MAX_IMAGE_BYTES,
  IMAGE_TOO_LARGE_MESSAGE,
  EDIT_WINDOW_HOURS,
  editWindow,
} from '../lib/limits';

export const DUPLICATE_MESSAGE =
  'Este reporte ya ha sido registrado en esta zona';

const IMAGE_BUCKET = 'incidencias';

function toneFor(status) {
  return statusTone[status] ?? 'warning';
}

// Última barrera de seguridad: aunque un cliente se salte el maxLength del
// formulario, aquí el texto nunca supera el límite de la base de datos.
function clip(value, max) {
  if (value == null) return value;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
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
  const report = {
    id: row.id,
    title: row.title,
    category: row.category,
    place: row.place,
    status: row.status,
    tone: toneFor(row.status),
    time: formatTime(row.created_at),
    created_at: row.created_at ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    user_id: row.user_id ?? null,
    image_url: row.image_url ?? null,
    tecnico_id: row.tecnico_id ?? null,
    tecnico_nombre: row.tecnico_nombre ?? null,
    informe: row.informe ?? null,
    materiales: row.materiales ?? null,
    informe_at: row.informe_at ?? null,
    informe_image_url: row.informe_image_url ?? null,
    editado_at: row.editado_at ? formatTime(row.editado_at) : null,
    cierre_resultado: row.cierre_resultado ?? null,
    mensaje_final: row.mensaje_final ?? null,
    mensaje_final_at: row.mensaje_final_at ? formatTime(row.mensaje_final_at) : null,
  };

  // La ventana de edición se calcula al traducir la fila para que
  // ReportCard y EditReportModal usen exactamente el mismo criterio.
  return { ...report, editWindow: editWindow(report) };
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
    .select('id, nombre, email, codigo')
    .eq('role', 'Técnico')
    // Por código, no por nombre: así aparecen TEC-0001, TEC-0002... en orden.
    .order('codigo', { ascending: true });
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
//
// Web y nativo NO se pueden llevar el mismo cuerpo de subida, y equivocarse
// cuesta un error que no explica nada: «Unsupported formDataPart
// implementation». Por qué pasa, y por qué aquí no se usan ni Blob ni
// FormData en Android/iOS:
//
// El cliente de Supabase envuelve un Blob en un FormData antes de enviarlo
// (StorageFileApi.ts, rama `fileBody instanceof Blob`). En nativo, el FormData
// de React Native solo sabe convertir sus piezas en dos formatos: texto, o un
// archivo con `uri`. Al estirar un Blob no aparece ningún `uri` ni ningún
// `string`, así que la pieza llega al módulo de red sin ninguno de los dos y
// Android/iOS abortan la petición.
//
// Lo que sí funciona en nativo es mandar los bytes pelados y dejar el
// content-type en la cabecera. La biblioteca de red de React Native convierte
// un ArrayBuffer o un Uint8Array en base64 por su cuenta
// (Libraries/Network/convertRequestBody.js), sin tocar FormData. Es
// además lo que recomienda la propia documentación de Supabase para React
// Native ("Upload file using ArrayBuffer from base64 file data instead").
//
// En web el Blob va perfectamente y es lo que se sigue usando.

function isReactNative() {
  return (
    typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
  );
}

function base64ToBytes(base64) {
  if (typeof atob === 'function') {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  throw new Error('No se pudo procesar la imagen en este dispositivo.');
}

function base64ToBlob(base64, mime) {
  if (typeof atob === 'function' && typeof Blob !== 'undefined') {
    return new Blob([base64ToBytes(base64)], { type: mime });
  }
  if (typeof Buffer !== 'undefined') {
    return new Blob([Buffer.from(base64, 'base64')], { type: mime });
  }
  throw new Error('No se pudo procesar la imagen en este dispositivo.');
}

// El base64 del asset, venga de donde venga. Devuelve null si no lo hay, para
// que la función que llama decida qué hacer.
function assetBase64(asset) {
  if (asset.base64) return asset.base64;
  if (typeof asset.uri === 'string' && asset.uri.startsWith('data:')) {
    const match = asset.uri.match(/^data:([^;]+);base64,(.+)$/);
    if (match) return match[2];
    throw new Error('Formato de imagen no soportado.');
  }
  return null;
}

// Último recurso en nativo: el asset no trajo base64, así que se lee el
// archivo del disco. En Android/iOS el uri es un file:// que fetch sí sabe
// leer.
async function bytesFromUri(uri) {
  if (typeof uri !== 'string' || !uri) {
    throw new Error('No se pudo leer la imagen.');
  }
  const res = await fetch(uri);
  if (!res.ok) throw new Error('No se pudo leer la imagen.');
  return new Uint8Array(await res.arrayBuffer());
}

function bodySize(body) {
  if (!body) return 0;
  if (typeof body === 'string') return body.length;
  // ArrayBuffer y sus vistas (Uint8Array): el tamaño real en bytes.
  if (typeof body.byteLength === 'number') return body.byteLength;
  // Blob: RN y web lo llaman "size".
  if (typeof body.size === 'number') return body.size;
  // FormData no da el tamaño, así que en ese caso se estima por el base64.
  return 0;
}

async function uploadImage(asset) {
  const mime = asset.mimeType || asset.type || 'image/jpeg';
  const ext = String(mime.split('/')[1] || 'jpg')
    .toLowerCase()
    .replace('jpeg', 'jpg');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const nativo = isReactNative();
  const b64 = assetBase64(asset);

  let body;
  if (nativo) {
    // Bytes pelados. Ni Blob ni FormData: aquí es donde nace el error.
    body = b64 ? base64ToBytes(b64) : await bytesFromUri(asset.uri);
  } else if (b64) {
    body = base64ToBlob(b64, mime);
  } else {
    // Sin datos de imagen: si el uri ya es remoto, se respeta tal cual.
    const esRemoto =
      typeof asset.uri === 'string' &&
      (asset.uri.startsWith('http://') || asset.uri.startsWith('https://'));
    if (esRemoto) return asset.uri;
    if (asset.uri) {
      body = await bytesFromUri(asset.uri);
    } else {
      return null;
    }
  }

  // Última barrera antes de gastar ancho de banda: el bucket también lo
  // limita, pero el error del servidor es mucho menos claro.
  const size = bodySize(body) || asset.fileSize || 0;
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(IMAGE_TOO_LARGE_MESSAGE);
  }

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, body, { contentType: mime, cacheControl: '3600' });
  if (error) {
    const message = error.message ?? '';
    if (/exceeded the maximum allowed size/i.test(message)) {
      throw new Error(IMAGE_TOO_LARGE_MESSAGE);
    }
    // Si aun así llegara aquí, el mensaje nativo no le dice nada a quien
    // reporta. Se traduce en vez de soltarlo tal cual.
    if (/formDataPart|unsupported.*formdata/i.test(message)) {
      throw new Error(
        'No se pudo adjuntar la foto en este dispositivo. Prueba a quitarla ' +
          'y volver a elegirla, o envía el reporte sin ella.'
      );
    }
    throw new Error(`No se pudo guardar la imagen: ${message}`);
  }

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
      title: clip(title, LIMITS.title),
      category,
      place: clip(place, LIMITS.place),
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

// El ciudadano puede corregir su reporte durante la primera hora, siempre
// que siga en "Pendiente".
//
// Esta comprobación es solo para dar un mensaje claro sin gastar una
// petición; la barrera real está en el trigger
// proteger_edicion_incidencia (supabase/schema.sql), que además sella
// `editado_at` desde el servidor para que no se pueda falsear.
export async function updateReport(
  id,
  {
    title,
    category,
    place,
    lat,
    lng,
    image_url,
    imageAsset,
    status: current,
    created_at,
  }
) {
  const window = editWindow({
    status: current ?? 'Pendiente',
    created_at,
  });

  if (!window.editable) {
    throw new Error(
      window.reason ||
        `Este reporte ya no se puede editar después de ${EDIT_WINDOW_HOURS} hora(s).`
    );
  }

  let finalImage = image_url ?? null;
  if (imageAsset) {
    finalImage = await uploadImage(imageAsset);
  }

  // Solo campos de contenido: el estado y las asignaciones no se tocan aquí.
  const { data, error } = await supabase
    .from('incidencias')
    .update({
      title: clip(title, LIMITS.title),
      category,
      place: clip(place, LIMITS.place),
      lat: lat ?? null,
      lng: lng ?? null,
      image_url: finalImage,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(friendlyEditError(error));
  return mapRow(data);
}

function friendlyEditError(error) {
  const message = error?.message ?? '';
  if (/no se puede editar|ya no se puede/i.test(message)) return message;
  return message || 'No se pudo actualizar el reporte.';
}

export async function updateReportStatus(id, status) {
  const { error } = await supabase.from('incidencias').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Mensaje de cierre del técnico ----

// El técnico escribe unas palabras para el ciudadano con el resultado
// del trabajo. `mensaje_final_at` lo sella el trigger del servidor, así
// que aquí solo se manda el texto.
export const MIN_MENSAJE_FINAL = 10;

export async function completeReport(
  id,
  {
    informe,
    materiales,
    status,
    imageAsset,
    informeImageUrl,
    cierre_resultado,
    mensaje_final,
  }
) {
  const patch = {
    informe: clip(informe, LIMITS.informe),
    materiales: clip(materiales, LIMITS.materiales),
    status: status ?? undefined,
    informe_at: new Date().toISOString(),
    cierre_resultado: cierre_resultado ?? null,
    mensaje_final: clip((mensaje_final ?? '').trim() || null, LIMITS.mensajeFinal),
  };

  // Foto de evidencia del trabajo, opcional. `null` significa "quítala",
  // `undefined` significa "déjala como está".
  if (imageAsset) {
    patch.informe_image_url = await uploadImage(imageAsset);
  } else if (informeImageUrl !== undefined) {
    patch.informe_image_url = informeImageUrl;
  }

  const { error } = await supabase
    .from('incidencias')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}