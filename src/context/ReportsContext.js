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
  assignTechnician,
  completeReport,
} from '../services/reports';
import { useAuth } from './AuthContext';
import { useConnection } from '../hooks/useConnection';
import { describeError } from '../lib/connection';

const ReportsContext = createContext(null);

export function ReportsProvider({ children }) {
  const { user, profile } = useAuth();
  const { online } = useConnection();
  const role = profile?.role;
  const [reports, setReports] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReports({ userId: user?.id, role });
      setReports(data);
      setError(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [user, role]);

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

  const assign = async (id, tecnicoId, tecnicoNombre) => {
    await assignTechnician(id, tecnicoId, tecnicoNombre);
    await refresh();
  };

  const complete = async (id, payload) => {
    await completeReport(id, payload);
    await refresh();
  };

  const value = {
    reports,
    technicians,
    loading,
    error,
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
