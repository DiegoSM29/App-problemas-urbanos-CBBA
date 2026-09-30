// Asignación de técnicos e historial de cambios.
//
// Todo pasa por el RPC `asignar_tecnico` (supabase/notificaciones.sql),
// no por un UPDATE directo, porque el RPC hace dos cosas a la vez en una
// sola transacción:
//   1. Comprueba que quien llama sea administrador.
//   2. Actualiza el reporte y escribe el registro en el historial.
//
// Si se hiciera el UPDATE desde la app, el cambio de técnico se
// sobrescribiría sin dejar rastro y el ciudadano no se enteraría.

import { supabase } from '../lib/supabase';
import { LIMITS } from '../lib/limits';

function mapAssignment(row) {
  const fecha = row.created_at ? new Date(row.created_at) : null;

  return {
    id: row.id,
    incidencia_id: row.incidencia_id,
    tecnico_id: row.tecnico_id ?? null,
    tecnico_nombre: row.tecnico_nombre ?? null,
    asignado_por: row.asignado_por ?? null,
    asignado_por_nombre: row.asignado_por_nombre ?? null,
    motivo: row.motivo ?? null,
    rol: row.rol,
    time: fecha ? formatDate(fecha) : '—',
  };
}

function formatDate(d) {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  if (sameDay) return `Hoy, ${hh}:${mm}`;

  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo}/${d.getFullYear()}, ${hh}:${mm}`;
}

// Asigna, cambia o quita el técnico de un reporte.
//
// `p_tecnico = null` deja el reporte sin técnico, que también queda
// registrado en el historial.
export async function assignTechnician(
  incidenciaId,
  tecnicoId,
  tecnicoNombre,
  motivo
) {
  const { error } = await supabase.rpc('asignar_tecnico', {
    p_incidencia: incidenciaId,
    p_tecnico: tecnicoId ?? null,
    p_nombre: tecnicoId ? (tecnicoNombre ?? null) : null,
    p_motivo: motivo?.trim() ? motivo.trim().slice(0, LIMITS.motivoReasignacion) : null,
  });

  if (error) {
    const message = error.message || 'No se pudo asignar el técnico.';

    // PGRST202/PGRST204: la API no encuentra el RPC. Es el fallo de PostgREST
    // cuando el script de la base de datos no se ha ejecutado, y el mensaje
    // que devuelve ("Could not find the function ... in the schema cache")
    // no le dice eso a nadie. Se traduce a lo que hay que hacer.
    if (/PGRST20[24]|Could not find the function/i.test(message)) {
      throw new Error(
        'La base de datos no tiene la función de asignar técnicos. ' +
        'Ejecuta supabase/notificaciones.sql en el SQL Editor de Supabase ' +
        'y después la consulta: notify pgrst, \'reload schema\';'
      );
    }

    // El resto de errores llegan como exception de Postgres. Se limpia un poco
    // para que el mensaje se pueda mostrar tal cual en la interfaz.
    throw new Error(message.replace(/^.*:\s*/, ''));
  }
}

// Historial de una incidencia concreta.
export async function fetchAssignments(incidenciaId) {
  const { data, error } = await supabase
    .from('incidencia_asignaciones')
    .select('*')
    .eq('incidencia_id', incidenciaId)
    .order('created_at', { ascending: true });

  if (error) {
    // Si la tabla todavía no existe (notificaciones.sql sin ejecutar), no
    // se rompe la pantalla: simplemente no hay historial que mostrar.
    if (/does not exist|PGRST205|42P01/i.test(error.message ?? '')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map(mapAssignment);
}

// Historial de varios reportes a la vez.
//
// El administrador lo usa para detectar de un vistazo los reportes que
// cambiaron de técnico, que es justo lo que antes no se podía ver.
export async function fetchAssignmentsFor(incidenciaIds) {
  const ids = [...new Set((incidenciaIds ?? []).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('incidencia_asignaciones')
    .select('*')
    .in('incidencia_id', ids)
    .order('created_at', { ascending: true });

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message ?? '')) {
      return new Map();
    }
    throw new Error(error.message);
  }

  const byReport = new Map();
  for (const row of data ?? []) {
    const list = byReport.get(row.incidencia_id) ?? [];
    list.push(mapAssignment(row));
    byReport.set(row.incidencia_id, list);
  }
  return byReport;
}

// Traduce el historial a algo legible para el ciudadano.
//
// Separa la asignación original de los cambios posteriores, porque el
// mensaje que le interesa es "a quién se lo cambiaron", no una lista
// técnica de eventos.
export function summarizeAssignments(assignments) {
  const list = assignments ?? [];
  if (!list.length) return null;

  const cambios = list.filter((a) => a.rol === 'reasignacion');

  if (!cambios.length) return null;

  const ultimo = cambios[cambios.length - 1];
  const anterior = cambios[cambios.length - 2] ?? list[0];

  return {
    huboCambio: true,
    total: cambios.length,
    de: anterior.tecnico_nombre,
    a: ultimo.tecnico_nombre,
    motivo: ultimo.motivo,
    time: ultimo.time,
  };
}
