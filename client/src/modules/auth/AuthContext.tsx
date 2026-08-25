import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from './auth.api';
import type { UsuarioAutenticado } from './auth.types';

interface AuthContextValue {
  user: UsuarioAutenticado | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UsuarioAutenticado>; // 👈 ahora devuelve el usuario
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioAutenticado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<UsuarioAutenticado> {
    const usuario = await authApi.login({ email, password });
    setUser(usuario);
    return usuario;
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}