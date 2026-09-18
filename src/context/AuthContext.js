import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabase } from '../services/supabase';
import * as authService from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function init() {
      const existing = await authService.getSessionUser();
      if (!active) return;
      if (existing) {
        setUser(existing);
        try {
          const p = await authService.fetchProfile(existing.id);
          if (active) setProfile(p);
        } catch {
          setProfile({ id: existing.id, email: existing.email, role: 'Ciudadano' });
        }
      }
      setLoading(false);
    }

    init();

    let sub;
    if (hasSupabase) {
      const result = supabase.auth.onAuthStateChange(async (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          try {
            const p = await authService.fetchProfile(nextUser.id);
            setProfile(p);
          } catch {
            setProfile({ id: nextUser.id, email: nextUser.email, role: 'Ciudadano' });
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
      sub = result?.data?.subscription;
    }

    return () => {
      active = false;
      if (sub) sub.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => {
    const login = async (email, password, role) => {
      if (!hasSupabase) {
        if (role === 'Técnico') {
          setUser({ id: 'tec-1', email });
          setProfile({
            id: 'tec-1',
            email,
            nombre: 'Carlos Mamani',
            role: 'Técnico',
          });
          return;
        }
        setUser({ id: 'demo', email });
        setProfile({ id: 'demo', email, role: role ?? 'Ciudadano' });
        return;
      }
      const nextUser = await authService.signIn(email, password);
      const p = await authService.fetchProfile(nextUser.id);
      if (role === 'Administrador' && p?.role !== 'Administrador') {
        await authService.signOut();
        throw new Error('Este usuario no tiene rol de administrador.');
      }
      if (role === 'Técnico' && p?.role !== 'Técnico') {
        await authService.signOut();
        throw new Error('Este usuario no tiene rol de técnico.');
      }
      setProfile(p);
    };

    const register = async (email, password, role, nombre) => {
      if (!hasSupabase) {
        const isTec = role === 'Técnico';
        const id = isTec ? 'tec-1' : 'demo';
        setUser({ id, email });
        setProfile({
          id,
          email,
          nombre: nombre ?? (isTec ? 'Carlos Mamani' : null),
          role,
        });
        return;
      }
      const nextUser = await authService.signUp(email, password, role, nombre);
      if (nextUser) {
        setUser(nextUser);
        setProfile({ id: nextUser.id, email, nombre, role });
      }
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
      demo: !hasSupabase,
      login,
      loginAsAdmin: (email, password) => login(email, password, 'Administrador'),
      loginAsTechnician: (email, password) => login(email, password, 'Técnico'),
      register,
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