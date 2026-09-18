import { supabase, hasSupabase } from './supabase';
import { statusTone } from '../theme/colors';

export const DUPLICATE_MESSAGE =
  'Este reporte ya ha sido registrado en esta zona';

export const demoTechnicians = [
  { id: 'tec-1', nombre: 'Carlos Mamani', email: 'carlos.mamani@cbba.gob' },
  { id: 'tec-2', nombre: 'Lucía Rojas', email: 'lucia.rojas@cbba.gob' },
  { id: 'tec-3', nombre: 'Marco Quispe', email: 'marco.quispe@cbba.gob' },
];

const seedReports = [
  {
    id: '1',
    title: 'Bache en la avenida',
    category: 'Vialidad',
    place: 'Av. América',
    status: 'Pendiente',
    time: 'Hoy, 09:42',
    user_id: 'demo',
    lat: -17.3833,
    lng: -66.1597,
    image_url: null,
    tecnico_id: 'tec-1',
    tecnico_nombre: 'Carlos Mamani',
    informe: null,
    materiales: null,
  },
  {
    id: '2',
    title: 'Iluminación defectuosa',
    category: 'Iluminación',
    place: 'Calle Colombia',
    status: 'En proceso',
    time: '10/04/2025',
    user_id: 'demo',
    lat: -17.3955,
    lng: -66.1652,
    image_url: null,
    tecnico_id: null,
    tecnico_nombre: null,
    informe: null,
    materiales: null,
  },
  {
    id: '3',
    title: 'Basura acumulada',
    category: 'Limpieza',
    place: 'Parque Lincoln',
    status: 'Resuelto',
    time: '08/04/2025',
    user_id: 'demo',
    lat: -17.3891,
    lng: -66.1573,
    image_url: null,
    tecnico_id: 'tec-1',
    tecnico_nombre: 'Carlos Mamani',
    informe: 'Se retiraron 4 bolsas de residuos y se limpió el área.',
    materiales: 'Bolsas industriales, guantes, escoba.',
  },
  {
    id: '4',
    title: 'Alumbrado público apagado',
    category: 'Iluminación',
    place: 'Calle Bolívar, zona centro',
    status: 'Pendiente',
    time: 'Hoy, 08:10',
    user_id: 'demo',
    lat: -17.3923,
    lng: -66.1601,
    image_url: null,
    tecnico_id: null,
    tecnico_nombre: null,
    informe: null,
    materiales: null,
  },
  {
    id: '5',
    title: 'Escombro en la calzada',
    category: 'Vialidad',
    place: 'Av. Circunvalación km 3',
    status: 'En proceso',
    time: '09/04/2025',
    user_id: 'demo',
    lat: -17.3789,
    lng: -66.1492,
    image_url: null,
    tecnico_id: 'tec-2',
    tecnico_nombre: 'Lucía Rojas',
    informe: null,
    materiales: null,
  },
];

let localStore = seedReports.map((r) => ({ ...r }));

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
    time: formatTime(row.created_at ?? row.time),
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    user_id: row.user_id ?? null,
    image_url: row.image_url ?? null,
    tecnico_id: row.tecnico_id ?? null,
    tecnico_nombre: row.tecnico_nombre ?? null,
    informe: row.informe ?? null,
    materiales: row.materiales ?? null,
  };
}

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function escapeLike(text) {
  return String(text ?? '').replace(/[%_\\]/g, '\\$&');
}

export async function fetchReports({ userId, role } = {}) {
  if (!hasSupabase) {
    if (role === 'Administrador') return localStore.map(mapRow);
    if (role === 'Técnico')
      return localStore.filter((r) => r.tecnico_id === userId).map(mapRow);
    return localStore
      .filter((r) => !r.user_id || r.user_id === userId)
      .map(mapRow);
  }

  let query = supabase
    .from('incidencias')
    .select('*')
    .order('created_at', { ascending: false });

  if (role === 'Técnico') {
    query = query.eq('tecnico_id', userId);
  } else if (role !== 'Administrador') {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapRow);
}

export async function fetchTechnicians() {
  if (!hasSupabase) return demoTechnicians.map((t) => ({ ...t }));

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nombre, role')
    .eq('role', 'Técnico')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function findDuplicate({ title, place, excludeId }) {
  const t = normalize(title);
  const p = normalize(place);
  if (!t || !p) return null;

  if (!hasSupabase) {
    return (
      localStore.find(
        (r) =>
          r.id !== excludeId &&
          normalize(r.title) === t &&
          normalize(r.place) === p
      ) ?? null
    );
  }

  const { data, error } = await supabase
    .from('incidencias')
    .select('id, title, place')
    .ilike('place', escapeLike(place.trim()))
    .ilike('title', escapeLike(title.trim()))
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

export async function createReport({
  title,
  category,
  place,
  lat,
  lng,
  user_id,
  image_url,
}) {
  const duplicate = await findDuplicate({ title, place });
  if (duplicate) throw new Error(DUPLICATE_MESSAGE);

  if (!hasSupabase) {
    const report = {
      id: String(Date.now()),
      title,
      category,
      place,
      status: 'Pendiente',
      time: 'Ahora',
      user_id,
      lat,
      lng,
      image_url: image_url ?? null,
      tecnico_id: null,
      tecnico_nombre: null,
      informe: null,
      materiales: null,
    };
    localStore = [report, ...localStore];
    return mapRow(report);
  }

  const { data, error } = await supabase
    .from('incidencias')
    .insert({ title, category, place, lat, lng, user_id, image_url })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateReportStatus(id, status) {
  if (!hasSupabase) {
    localStore = localStore.map((r) =>
      r.id === id ? { ...r, status } : r
    );
    return;
  }

  const { error } = await supabase
    .from('incidencias')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function assignTechnician(id, tecnicoId, tecnicoNombre) {
  if (!hasSupabase) {
    localStore = localStore.map((r) =>
      r.id === id
        ? { ...r, tecnico_id: tecnicoId, tecnico_nombre: tecnicoNombre }
        : r
    );
    return;
  }

  const { error } = await supabase
    .from('incidencias')
    .update({ tecnico_id: tecnicoId, tecnico_nombre: tecnicoNombre })
    .eq('id', id);

  if (error) throw error;
}

export async function completeReport(id, { informe, materiales, status }) {
  if (!hasSupabase) {
    localStore = localStore.map((r) =>
      r.id === id
        ? { ...r, informe, materiales, status: status ?? r.status }
        : r
    );
    return;
  }

  const { error } = await supabase
    .from('incidencias')
    .update({
      informe,
      materiales,
      status: status ?? 'Resuelto',
      informe_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}
