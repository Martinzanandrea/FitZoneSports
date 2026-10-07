import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from './auth.api';
import type { UsuarioAutenticado } from './auth.types';

interface AuthContextValue {
  user: UsuarioAutenticado | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UsuarioAutenticado>; // 👈 ahora devuelve el usuario
  logout: () => Promise<void>;
  // Vuelve a pedir /auth/me y actualiza el usuario (p. ej. tras pasar de EXTERNO a SOCIO).
  refrescarUsuario: () => Promise<UsuarioAutenticado>;
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

  // Sin tocar `loading`: no desmonta las rutas protegidas mientras refresca.
  const refrescarUsuario = useCallback(async (): Promise<UsuarioAutenticado> => {
    const usuario = await authApi.me();
    setUser(usuario);
    return usuario;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refrescarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}