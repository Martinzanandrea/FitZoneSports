import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { registrarManejadorSesion } from '../../api/axios';
import { decidirTrasFalloAlArrancar } from '../../api/clasificarError';
import { rutaPanelStaff } from '../../shared/utils/rutaPanel';
import { unaVez } from '../../shared/utils/unaVez';
import { desuscribirDispositivo, reenviarSuscripcionExistente } from '../notificaciones/push.cliente';
import { authApi } from './auth.api';
import type { UsuarioAutenticado } from './auth.types';
import { borrarUsuarioLocal, guardarUsuarioLocal, leerUsuarioLocal } from './sesionLocal';

// Mientras no hay red, el servidor no puede confirmar la sesión: se reintenta cada tanto.
const REINTENTO_VERIFICACION_MS = 30_000;

const CANAL = 'fitzone-auth';
const CLAVE_STORAGE = 'fitzone-auth-evento';

function esOtraSesion(a: UsuarioAutenticado | null, b: UsuarioAutenticado | null): boolean {
  return a?.id !== b?.id || a?.tipoActor !== b?.tipoActor || a?.sedeId !== b?.sedeId;
}

const enLogin = () => ['/login', '/admin/login'].includes(window.location.pathname);

interface AuthContextValue {
  user: UsuarioAutenticado | null;
  loading: boolean;
  // true si la app arrancó sin poder consultar al servidor y se conserva el usuario
  // guardado localmente; se verifica sola al volver la conexión.
  sesionSinVerificar: boolean;
  login: (email: string, password: string) => Promise<UsuarioAutenticado>; // 👈 ahora devuelve el usuario
  logout: () => Promise<void>;
  // Vuelve a pedir /auth/me y actualiza el usuario (p. ej. tras pasar de EXTERNO a SOCIO).
  refrescarUsuario: () => Promise<UsuarioAutenticado>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioAutenticado | null>(null);
  const [loading, setLoading] = useState(true);
  const [sesionSinVerificar, setSesionSinVerificar] = useState(false);
  const navigate = useNavigate();
  // Refs: los listeners (axios, eventos, canal) viven más que cada render.
  const userRef = useRef<UsuarioAutenticado | null>(null);
  const canalRef = useRef<BroadcastChannel | null>(null);
  const sinVerificarRef = useRef(false);

  const marcarSinVerificar = useCallback((valor: boolean) => {
    sinVerificarRef.current = valor;
    setSesionSinVerificar(valor);
  }, []);

  const aplicarUsuario = useCallback(
    (u: UsuarioAutenticado | null) => {
      userRef.current = u;
      setUser(u);
      marcarSinVerificar(false);
      // Copia local solo del usuario (sin tokens) para poder abrir la app sin red.
      if (u) guardarUsuarioLocal(u);
      else borrarUsuarioLocal();
    },
    [marcarSinVerificar],
  );

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
      // Error de red o servidor caído: no se toca la sesión. Con la sesión sin
      // verificar, un 403 también la invalida (usuario desactivado).
      const invalida = status === 401 || (status === 403 && sinVerificarRef.current);
      if (!invalida) return false;
      real = null;
    }
    if (real) {
      // El servidor confirmó la sesión: deja de estar "sin verificar" y renueva la copia local.
      marcarSinVerificar(false);
      guardarUsuarioLocal(real);
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
  }, [aplicarUsuario, marcarSinVerificar, navigate]);

  useEffect(() => {
    authApi
      .me()
      .then(aplicarUsuario)
      .catch((err: unknown) => {
        const local = leerUsuarioLocal();
        if (local && decidirTrasFalloAlArrancar(err, navigator.onLine, true) === 'CONSERVAR_SIN_VERIFICAR') {
          // Sin red (o servidor caído): se sigue con el usuario guardado, sin renovar su copia.
          userRef.current = local;
          setUser(local);
          marcarSinVerificar(true);
        } else {
          aplicarUsuario(null);
        }
      })
      .finally(() => setLoading(false));
  }, [aplicarUsuario, marcarSinVerificar]);

  // Con la sesión sin verificar: al volver la conexión (y cada tanto, por si el
  // servidor estaba caído con red) se reintenta la verificación en segundo plano.
  useEffect(() => {
    if (!sesionSinVerificar) return;
    const verificar = () => void sincronizar();
    window.addEventListener('online', verificar);
    const id = setInterval(() => {
      if (navigator.onLine) verificar();
    }, REINTENTO_VERIFICACION_MS);
    return () => {
      window.removeEventListener('online', verificar);
      clearInterval(id);
    };
  }, [sesionSinVerificar, sincronizar]);

  // Con sesión y permiso ya concedido, reasocia la suscripción push de este dispositivo al usuario actual.
  const usuarioId = user?.id;
  useEffect(() => {
    if (usuarioId) void reenviarSuscripcionExistente();
  }, [usuarioId]);

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
    // Antes de perder la cookie; acotado en tiempo y sin lanzar error, no bloquea el cierre.
    await desuscribirDispositivo();
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
    <AuthContext.Provider value={{ user, loading, sesionSinVerificar, login, logout, refrescarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- export auxiliar (constante/hook) junto al componente: solo afecta el refresco en caliente en desarrollo; moverlo obligaría a cambiar los importadores
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}