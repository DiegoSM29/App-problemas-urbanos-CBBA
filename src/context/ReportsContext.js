import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  fetchReports,
  fetchMapReports,
  fetchTechnicians,
  createReport,
  updateReport,
  updateReportStatus,
  completeReport,
  reopenReport,
} from '../services/reports';
import {
  assignTechnician,
  fetchAssignmentsFor,
} from '../services/asignaciones';
import { useAuth } from './AuthContext';
import { useConnection } from '../hooks/useConnection';
import { describeError } from '../lib/connection';

const ReportsContext = createContext(null);

// Traduce los errores de Supabase a una pista accionable. Sin esto, un
// 42501 ("permission denied") solo llegaba como texto críptico y no se
// distinguía de un problema de conexión.
function hintForError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? error ?? '');

  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'La base de datos no deja leer estos reportes con tu cuenta. Ejecuta supabase/schema.sql en el SQL Editor y revisa que tu perfil tenga el rol Administrador.';
  }
  if (code === '42P01' || /does not exist/i.test(message)) {
    return 'Falta alguna tabla en la base de datos. Ejecuta schema.sql y luego notificaciones.sql.';
  }
  if (/JWT|token/i.test(message)) {
    return 'Tu sesión caducó. Cierra sesión y vuelve a entrar.';
  }
  return null;
}

export function ReportsProvider({ children }) {
  const { user, profile } = useAuth();
  const { online } = useConnection();
  const role = profile?.role;
  const [reports, setReports] = useState([]);
  // Lo que se dibuja en el mapa. Para el administrador y el técnico es la
  // misma lista de arriba; para el ciudadano son todos los reportes de la
  // ciudad (solo los datos del pin). Vive aparte porque la lista de "Mis
  // reportes" del ciudadano no puede cambiar: RLS sigue limitándola a los
  // suyos, que es lo que debe ver en su propia pantalla.
  const [mapReports, setMapReports] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [assignments, setAssignments] = useState(() => new Map());
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);

  const loadAssignments = useCallback(async (list) => {
    try {
      setAssignments(await fetchAssignmentsFor(list.map((r) => r.id)));
    } catch {
      // El historial es un extra: si falla, el resto de la pantalla
      // tiene que seguir funcionando igual.
      setAssignments(new Map());
    }
  }, []);

  // El mapa se carga por su cuenta y nunca rompe la pantalla de reportes:
  // si el RPC todavía no existe en la base, el ciudadano sigue viendo sus
  // reportes y solo el mapa queda sin datos.
  const loadMap = useCallback(async (args) => {
    setMapLoading(true);
    try {
      setMapReports(await fetchMapReports(args));
    } catch (e) {
      setMapReports([]);
      console.warn('No se pudo cargar el mapa:', e?.message ?? e);
    } finally {
      setMapLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReports({ userId: user?.id, role });
      setReports(data);
      setError(null);
      setDiagnostic(null);
      loadAssignments(data);
      loadMap({ userId: user?.id, role });
    } catch (e) {
      setError(describeError(e));
      // Se guarda el error técnico de Supabase (por ejemplo 42501,
      // "permission denied"). Antes solo se mostraba el texto ya
      // traducido y no había forma de saber si era un problema de
      // permisos, de red o de una consulta mal formada.
      setDiagnostic({
        message: e?.message ?? String(e),
        code: e?.code ?? null,
        hint: hintForError(e),
      });
    } finally {
      setLoading(false);
    }
  }, [user, role, loadAssignments]);

  useEffect(() => {
    if (user) refresh();
    else {
      setReports([]);
      setMapReports([]);
    }
  }, [user, refresh]);

  // Al recuperar la conexión se recarga la lista para no dejar la vista
  // desactualizada con los datos que ya había.
  const wasOnline = useRef(online);
  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    if (!previous && online && user) refresh();
  }, [online, user, refresh]);

  useEffect(() => {
    let active = true;
    if (role === 'Administrador') {
      fetchTechnicians()
        .then((list) => {
          if (active) setTechnicians(list);
        })
        .catch(() => {
          if (active) setTechnicians([]);
        });
    } else {
      setTechnicians([]);
    }
    return () => {
      active = false;
    };
  }, [role]);

  const create = async (payload) => {
    // Los pines del mapa son los reportes de toda la ciudad, y son la única
    // fuente desde la que se puede saber que el problema ya lo reportó OTRO
    // vecino: RLS no deja leer su tabla, así que sin esto la comprobación de
    // duplicados solo vería los del propio ciudadano, que es donde la regla no
    // dice casi nada.
    const created = await createReport({
      ...payload,
      user_id: user?.id,
      reportesCercanos: mapReports,
    });
    await refresh();
    return created;
  };

  const edit = async (id, payload) => {
    await updateReport(id, payload);
    await refresh();
  };

  const changeStatus = async (id, status) => {
    await updateReportStatus(id, status);
    await refresh();
  };

  // El RPC asignar_tecnico actualiza el reporte y escribe el historial
  // en una transacción, así que aquí solo hace falta refrescar.
  const assign = async (id, tecnicoId, tecnicoNombre, motivo) => {
    await assignTechnician(id, tecnicoId, tecnicoNombre, motivo);
    await refresh();
  };

  const complete = async (id, payload) => {
    await completeReport(id, payload);
    await refresh();
  };

  // El ciudadano devuelve al municipio un reporte ya resuelto. El motivo lo
  // pone en el modal; el estado, la fecha y el contador los sella el trigger.
  const reopen = async (id, motivo, statusActual) => {
    await reopenReport(id, motivo, statusActual);
    await refresh();
  };

  const value = {
    reports,
    mapReports,
    mapLoading,
    technicians,
    assignments,
    loading,
    error,
    diagnostic,
    refresh,
    create,
    edit,
    changeStatus,
    assign,
    complete,
    reopen,
  };

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}

export const useReports = () => {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReports debe usarse dentro de ReportsProvider');
  return ctx;
};
