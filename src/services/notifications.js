// Bandeja de notificaciones.
//
// La tabla `notificaciones` (supabase/notificaciones.sql) la escriben
// únicamente los triggers de la base de datos, así que desde la app solo
// se puede leer y marcar como leída. No hay forma de crear un aviso
// falso ni de leaks avisos ajenos: RLS filtra por destinatario.

import { supabase } from '../lib/supabase';

// Icono y color por tipo, para que la bandeja se lea de un vistazo.
export const NOTIFICATION_META = {
  reporte_nuevo: { icon: '⚑', color: 'info', label: 'Nuevo reporte' },
  asignacion: { icon: '✚', color: 'warning', label: 'Asignación' },
  reasignado: { icon: '⇄', color: 'purple', label: 'Cambio de técnico' },
  resuelto: { icon: '✓', color: 'success', label: 'Resuelto' },
  mensaje_final: { icon: '✎', color: 'success', label: 'Mensaje del técnico' },
};

function mapRow(row) {
  const fecha = new Date(row.created_at);
  const meta = NOTIFICATION_META[row.tipo] ?? {
    icon: '●',
    color: 'info',
    label: 'Aviso',
  };

  return {
    id: row.id,
    tipo: row.tipo,
    ...meta,
    titulo: row.titulo,
    cuerpo: row.cuerpo,
    incidencia_id: row.incidencia_id ?? null,
    leida: row.leida,
    created_at: row.created_at,
    time: formatTime(fecha),
    hoy: fecha.toDateString() === new Date().toDateString(),
  };
}

function formatTime(d) {
  if (Number.isNaN(d.getTime())) return '—';

  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  if (d.toDateString() === now.toDateString()) return `Hoy, ${hh}:${mm}`;

  const ayer = new Date(now);
  ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hh}:${mm}`;

  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} · ${hh}:${mm}`;
}

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, cuerpo, incidencia_id, leida, created_at')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    // La tabla puede no existir todavía si notificaciones.sql aún no se
    // ejecutó. En ese caso la app funciona igual, solo sin bandeja.
    if (/does not exist|PGRST205|42P01/i.test(error.message ?? '')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function markRead(id) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllRead() {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('leida', false);
  if (error) throw new Error(error.message);
}

export async function unreadCount() {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('leida', false);

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message ?? '')) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}
