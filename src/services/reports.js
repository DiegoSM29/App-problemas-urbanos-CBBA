// Acceso a las incidencias de la base de datos local (services/db.js).
// Cada rol ve lo que le corresponde:
//   - Ciudadano → sus propios reportes
//   - Administrador → todos los reportes
//   - Técnico → los reportes asignados a él

import { loadDb, saveDb } from './db';
import { statusTone } from '../theme/colors';

export const DUPLICATE_MESSAGE =
  'Este reporte ya ha sido registrado en esta zona';

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

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function fetchReports({ userId, role } = {}) {
  const db = loadDb();
  let rows = [...db.reports];

  if (role === 'Técnico') {
    rows = rows.filter((r) => r.tecnico_id === userId);
  } else if (role !== 'Administrador') {
    rows = rows.filter((r) => r.user_id === userId);
  }

  rows.sort((a, b) =>
    String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  );
  return rows.map(mapRow);
}

export async function fetchTechnicians() {
  return loadDb()
    .users.filter((u) => u.role === 'Técnico')
    .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }));
}

export async function findDuplicate({ title, place, excludeId }) {
  const t = normalize(title);
  const p = normalize(place);
  if (!t || !p) return null;
  return (
    loadDb().reports.find(
      (r) =>
        r.id !== excludeId &&
        normalize(r.title) === t &&
        normalize(r.place) === p
    ) ?? null
  );
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

  const db = loadDb();
  const report = {
    id: `r-${Date.now()}`,
    title,
    category,
    place,
    status: 'Pendiente',
    created_at: new Date().toISOString(),
    user_id: user_id ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    image_url: image_url ?? null,
    tecnico_id: null,
    tecnico_nombre: null,
    informe: null,
    materiales: null,
    informe_at: null,
  };
  db.reports = [report, ...db.reports];
  saveDb(db);
  return mapRow(report);
}

export async function updateReportStatus(id, status) {
  const db = loadDb();
  db.reports = db.reports.map((r) => (r.id === id ? { ...r, status } : r));
  saveDb(db);
}

export async function assignTechnician(id, tecnicoId, tecnicoNombre) {
  const db = loadDb();
  db.reports = db.reports.map((r) =>
    r.id === id
      ? { ...r, tecnico_id: tecnicoId, tecnico_nombre: tecnicoNombre }
      : r
  );
  saveDb(db);
}

export async function completeReport(id, { informe, materiales, status }) {
  const db = loadDb();
  db.reports = db.reports.map((r) =>
    r.id === id
      ? {
          ...r,
          informe,
          materiales,
          status: status ?? r.status,
          informe_at: new Date().toISOString(),
        }
      : r
  );
  saveDb(db);
}
