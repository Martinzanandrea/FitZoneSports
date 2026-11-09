import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { TipoActor } from '../shared/types/enums';
import { rutaPanelPorRol } from '../shared/utils/rutaPanel';

interface Props {
  children: React.ReactNode;
  allowedRoles?: TipoActor[];
  loginPath?: string; // a dónde mandar si no está logueado (default: /login)
}

export function ProtectedRoute({
  children,
  allowedRoles,
  loginPath = '/login',
}: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen text-[#6B7280]">Cargando…</div>;
  if (!user) return <Navigate to={loginPath} replace />;
  if (allowedRoles && !allowedRoles.includes(user.tipoActor)) {
    // Con el usuario ya sincronizado, cada rol va a su propio panel.
    return <Navigate to={rutaPanelPorRol(user.tipoActor)} replace />;
  }
  // Un Recepcionista o Gerente de Sede sin sede asignada no puede operar
  // (el backend responde 403): va a la pantalla de bloqueo en cualquier
  // ruta bajo /admin (excepto la propia pantalla).
  if (
    (user.tipoActor === TipoActor.RECEPCIONISTA || user.tipoActor === TipoActor.GERENTE_SEDE) &&
    !user.sedeId &&
    location.pathname.startsWith('/admin') &&
    location.pathname !== '/admin/sin-sede'
  ) {
    return <Navigate to="/admin/sin-sede" replace />;
  }

  return <>{children}</>;
}