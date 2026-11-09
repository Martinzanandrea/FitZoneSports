import { useAuth } from '../../modules/auth/AuthContext';
import { ROLES_CLIENTE } from '../types/roles';
import { rutaPanelStaff } from '../utils/rutaPanel';

// Destino de los botones de plan según quién mira la página: visitante →
// registro; socio o externo → completar membresía; staff → su panel.
export function useDestinoMembresia() {
  const { user } = useAuth();
  if (!user) return { to: '/registro', label: 'Registrarme' };
  if (ROLES_CLIENTE.includes(user.tipoActor)) return { to: '/completar-membresia', label: 'Elegir mi plan' };
  return { to: rutaPanelStaff(user.tipoActor) ?? '/', label: 'Ir a mi panel' };
}
