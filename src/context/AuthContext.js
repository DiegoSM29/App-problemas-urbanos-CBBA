import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restaura la sesión guardada (si recargas la página sigues dentro).
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const existing = await authService.getSessionUser();
        if (active && existing) {
          setUser(existing);
          setProfile(existing);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => {
    // Entra con código/correo + contraseña. El rol lo define la cuenta.
    const login = async (identifier, password) => {
      const nextUser = await authService.signIn(identifier, password);
      const p = (await authService.fetchProfile(nextUser.id)) ?? nextUser;
      setUser(nextUser);
      setProfile(p);
    };

    const logout = async () => {
      await authService.signOut();
      setUser(null);
      setProfile(null);
    };

    return {
      user,
      profile,
      isAdmin: profile?.role === 'Administrador',
      isTechnician: profile?.role === 'Técnico',
      loading,
      login,
      logout,
    };
  }, [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
