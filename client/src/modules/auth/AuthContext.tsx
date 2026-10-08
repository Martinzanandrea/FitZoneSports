import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { registrarManejadorSesion } from '../../api/axios';
import { rutaPanelStaff } from '../../shared/utils/rutaPanel';
import { unaVez } from '../../shared/utils/unaVez';
import { authApi } from './auth.api';
import type { UsuarioAutenticado } from './auth.types';

const CANAL = 'fitzone-auth';
const CLAVE_STORAGE = 'fitzone-auth-evento';

function esOtraSesion(a: UsuarioAutenticado | null, b: UsuarioAutenticado | null): boolean {
  return a?.id !== b?.id || a?.tipoActor !== b?.tipoActor || a?.sedeId !== b?.sedeId;
}

const enLogin = () => ['/login', '/admin/login'].includes(window.location.pathname);

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
  const navigate = useNavigate();
  // Refs: los listeners (axios, eventos, canal) viven más que cada render.
  const userRef = useRef<UsuarioAutenticado | null>(null);
  const canalRef = useRef<BroadcastChannel | null>(null);

  const aplicarUsuario = useCallback((u: UsuarioAutenticado | null) => {
    userRef.current = u;
    setUser(u);
  }, []);

  // Avisa a las demás pestañas que cambió la sesión (sin token: solo la señal).
  const avisarOtrasPestanas = useCallback((tipo: 'login' | 'logout') => {
    if (canalRef.current) {
      canalRef.current.postMessage(tipo);
      return;
    }
    try {
      localStorage.setItem(CLAVE_STORAGE, `${tipo}:${Date.now()}`);
    } catch {
      /* sin localStorage: la otra pestaña se entera al volver a ella */
    }
  }, []);

  // Pregunta quién es el usuario real de la cookie. Si difiere del estado, actualiza
  // y manda al panel que corresponde. Devuelve true si la sesión cambió.
  const sincronizar = useCallback(async (): Promise<boolean> => {
    let real: UsuarioAutenticado | null;
    try {
      real = await unaVez('auth-me', () => authApi.me());
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      // Error de red o servidor caído: no se toca la sesión.
      if (status !== 401) return false;
      real = null;
    }
    const previo = userRef.current;
    if (!esOtraSesion(previo, real)) return false;

    aplicarUsuario(real);
    if (!enLogin()) {
      if (real) {
        navigate(rutaPanelStaff(real.tipoActor) ?? '/dashboard', { replace: true });
      } else if (previo) {
        navigate(window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login', { replace: true });
      }
    }
    return true;
  }, [aplicarUsuario, navigate]);

  useEffect(() => {
    authApi
      .me()
      .then(aplicarUsuario)
      .catch(() => aplicarUsuario(null))
      .finally(() => setLoading(false));
  }, [aplicarUsuario]);

  // Reacciones de axios: 401 (sesión vencida) y 403 (¿otro usuario en la cookie?).
  useEffect(() => {
    registrarManejadorSesion({
      sesionVencida: () => {
        aplicarUsuario(null);
        navigate(window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login', { replace: true });
      },
      revalidarTras403: () => unaVez('auth-403', sincronizar),
    });
    return () => registrarManejadorSesion(null);
  }, [aplicarUsuario, navigate, sincronizar]);

  // Sincronización entre pestañas: al volver a la pestaña y por avisos de login/logout.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void sincronizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);

    let canal: BroadcastChannel | null = null;
    let alStorage: ((e: StorageEvent) => void) | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      canal = new BroadcastChannel(CANAL);
      canal.onmessage = () => void sincronizar();
      canalRef.current = canal;
    } else {
      alStorage = (e) => {
        if (e.key === CLAVE_STORAGE) void sincronizar();
      };
      window.addEventListener('storage', alStorage);
    }

    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      if (alStorage) window.removeEventListener('storage', alStorage);
      canal?.close();
      canalRef.current = null;
    };
  }, [sincronizar]);

  async function login(email: string, password: string): Promise<UsuarioAutenticado> {
    const usuario = await authApi.login({ email, password });
    aplicarUsuario(usuario);
    avisarOtrasPestanas('login');
    return usuario;
  }

  async function logout() {
    await authApi.logout();
    aplicarUsuario(null);
    avisarOtrasPestanas('logout');
  }

  // Sin tocar `loading`: no desmonta las rutas protegidas mientras refresca.
  const refrescarUsuario = useCallback(async (): Promise<UsuarioAutenticado> => {
    const usuario = await authApi.me();
    aplicarUsuario(usuario);
    return usuario;
  }, [aplicarUsuario]);

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