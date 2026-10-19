import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../modules/auth/AuthContext';
import { useModoStandalone } from '../../hooks/useModoStandalone';
import { destinoInicioApp } from '../../utils/rutaPanel';
import { PublicShell } from './Landing';

// Layout público compartido (barra + pie) para la landing y las páginas
// públicas: /, /clases, /canchas, /sedes, /nosotros, /terminos.
export function PublicLayout() {
  const standalone = useModoStandalone();
  const { user, loading } = useAuth();
  const location = useLocation();

  // App instalada: la web pública no es punto de entrada. "/" siempre, y cualquier otra página
  // pública cuando es la primera de la sesión (key 'default'), redirigen una vez resuelta la sesión.
  // Las páginas públicas a las que se llega navegando dentro de la app (términos) se muestran.
  if (standalone && (location.pathname === '/' || location.key === 'default')) {
    if (loading) {
      return <div className="flex items-center justify-center h-screen text-[#6B7280]">Cargando…</div>;
    }
    return <Navigate to={destinoInicioApp(user?.tipoActor)} replace />;
  }

  return (
    <PublicShell>
      <Outlet />
    </PublicShell>
  );
}
