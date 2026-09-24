import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sincroniza el estado con la sesión de Supabase Auth y carga el perfil.
  useEffect(() => {
    let active = true;

    const sync = async (session) => {
      const nextUser = session?.user ?? null;
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        const p = await authService.fetchProfile(nextUser.id);
        if (active) {
          setProfile(
            p ?? {
              id: nextUser.id,
              email: nextUser.email,
              role: 'Ciudadano',
            }
          );
        }
      } else {
        setProfile(null);
      }
    };

    (async () => {
      try {
        const session = await authService.getSession();
        await sync(session);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: subscription } = authService.onAuthStateChange((session) => {
      sync(session);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const login = async (identifier, password) => {
      await authService.signIn(identifier, password);
      // El usuario/perfil se actualiza vía onAuthStateChange.
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