import { useAuth } from '../../auth/AuthContext';
import { TipoActor } from '../../../shared/types/enums';
import { ExternoInicio } from './ExternoInicio';
import { SocioInicio } from './SocioInicio';

// El Inicio depende del rol: el Externo tiene su propia pantalla
// (sin QR ni membresía) y nunca ve la del Socio.
export function Dashboard() {
  const { user } = useAuth();
  if (user?.tipoActor === TipoActor.EXTERNO) return <ExternoInicio />;
  return <SocioInicio />;
}
