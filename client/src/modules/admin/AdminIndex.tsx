import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { TipoActor } from '../../shared/types/enums';

export function AdminIndex() {
  const { user } = useAuth();

  if (user?.tipoActor === TipoActor.GERENTE) {
    return <Navigate to="/admin/gerente" replace />;
  }
  if (user?.tipoActor === TipoActor.RECEPCIONISTA) {
    return <Navigate to="/admin/recepcion" replace />;
  }
  return <Navigate to="/" replace />;
}