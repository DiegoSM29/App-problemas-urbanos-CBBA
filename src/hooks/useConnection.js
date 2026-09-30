import { useSyncExternalStore } from 'react';
import { getStatus, subscribe } from '../lib/connection';

// Estado de la conexión compartido por toda la app.
export function useConnection() {
  const status = useSyncExternalStore(subscribe, getStatus, getStatus);
  return { status, online: status === 'online' };
}
