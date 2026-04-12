import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, login as apiLogin, logout as apiLogout, refreshToken, setOnUnauthorized, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login:  (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const handleUnauthorized = useCallback(() => {
    setState({ user: null, loading: false });
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized);
    // Try to restore session via refresh cookie
    refreshToken()
      .then(async () => {
        const data = await api.get<{ user: User }>('/cms/auth/me');
        setState({ user: data.user, loading: false });
      })
      .catch(() => setState({ user: null, loading: false }));
  }, [handleUnauthorized]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setState({ user: data.user, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
