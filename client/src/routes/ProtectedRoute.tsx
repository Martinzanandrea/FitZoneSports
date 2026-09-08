import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { TipoActor } from '../shared/types/enums';

interface Props {
  children: React.ReactNode;
  allowedRoles?: TipoActor[];
  loginPath?: string; // a dónde mandar si no está logueado (default: /login)
  fallbackPath?: string; // a dónde mandar si el rol no matchea (default: /)
}

export function ProtectedRoute({
  children,
  allowedRoles,
  loginPath = '/login',
  fallbackPath = '/',
}: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen text-[#6B7280]">Cargando…</div>;
  if (!user) return <Navigate to={loginPath} replace />;
  if (allowedRoles && !allowedRoles.includes(user.tipoActor)) {
    return <Navigate to={fallbackPath} replace />;
  }
  // Un Recepcionista sin sede asignada no puede operar: va a la pantalla
  // de bloqueo en cualquier ruta bajo /admin (excepto la propia pantalla).
  if (
    user.tipoActor === TipoActor.RECEPCIONISTA &&
    !user.sedeId &&
    location.pathname.startsWith('/admin') &&
    location.pathname !== '/admin/sin-sede'
  ) {
    return <Navigate to="/admin/sin-sede" replace />;
  }

  return <>{children}</>;
}