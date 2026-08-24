import { Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { TipoActor } from '../shared/types/enums';

interface Props {
  children: React.ReactNode;
  allowedRoles?: TipoActor[];
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.tipoActor)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}