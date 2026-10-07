import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { rutaPanelStaff } from '../../shared/utils/rutaPanel';

export function AdminIndex() {
  const { user } = useAuth();
  const destino = user ? rutaPanelStaff(user.tipoActor) : null;

  return <Navigate to={destino ?? '/'} replace />;
}