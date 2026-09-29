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
  fetchTechnicians,
  createReport,
  updateReport,
  updateReportStatus,
  completeReport,
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
  const [technicians, setTechnicians] = useState([]);
  const [assignments, setAssignments] = useState(() => new Map());
  const [loading, setLoading] = useState(false);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReports({ userId: user?.id, role });
      setReports(data);
      setError(null);
      setDiagnostic(null);
      loadAssignments(data);
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
    else setReports([]);
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
    const created = await createReport({ ...payload, user_id: user?.id });
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

  const value = {
    reports,
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
