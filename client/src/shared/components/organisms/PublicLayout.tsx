import { Outlet } from 'react-router-dom';
import { PublicShell } from './Landing';

// Layout público compartido (barra + pie) para la landing y las páginas
// públicas: /, /clases, /canchas, /sedes, /nosotros, /terminos.
export function PublicLayout() {
  return (
    <PublicShell>
      <Outlet />
    </PublicShell>
  );
}
