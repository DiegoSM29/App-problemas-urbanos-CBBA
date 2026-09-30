import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as notificationsService from '../services/notifications';
import { useAuth } from './AuthContext';
import { useConnection } from '../hooks/useConnection';
import { describeError } from '../lib/connection';

const NotificationsContext = createContext(null);

// Cada cuánto se pregunta por avisos nuevos. Suficiente para que se
// note rápido sin castigar la base de datos en una demo con 3 usuarios.
const POLL_MS = 25000;

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const { online } = useConnection();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Se guardan los ids ya vistos para poder avisar con un banner solo
  // cuando entra algo de verdad, y no en cada refresco.
  const knownIds = useRef(null);
  const [newest, setNewest] = useState(null);

  const refresh = useCallback(
    async ({ silent = true } = {}) => {
      if (!user) return;

      if (!silent) setLoading(true);
      try {
        const data = await notificationsService.fetchNotifications();
        setItems(data);
        setError(null);

        // Primer arranque: solo se memoriza, sin banner.
        if (knownIds.current === null) {
          knownIds.current = new Set(data.map((n) => n.id));
        } else {
          const fresh = data.filter((n) => !knownIds.current.has(n.id));
          if (fresh.length) {
            setNewest(fresh[0]);
            knownIds.current = new Set(data.map((n) => n.id));
          }
        }
      } catch (e) {
        setError(describeError(e));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      setItems([]);
      knownIds.current = null;
      return;
    }
    refresh();
  }, [user, refresh]);

  // Sondeo periódico, pero solo mientras haya internet.
  useEffect(() => {
    if (!user || !online) return undefined;

    const timer = setInterval(() => refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [user, online, refresh]);

  const dismissNewest = useCallback(() => setNewest(null), []);

  const markRead = useCallback(
    async (id) => {
      // Se actualiza en memoria al instante para que la lista no se
      // sienta lenta, y se confirma con la base después.
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      );
      try {
        await notificationsService.markRead(id);
      } catch (e) {
        setError(describeError(e));
        refresh();
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    try {
      await notificationsService.markAllRead();
    } catch (e) {
      setError(describeError(e));
      refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      items,
      loading,
      error,
      refresh,
      newest,
      dismissNewest,
      markRead,
      markAllRead,
      unread: items.filter((n) => !n.leida).length,
    }),
    [items, loading, error, refresh, newest, dismissNewest, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  }
  return ctx;
};
