import { Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout } from '../../auth/AuthLayout';
import { EmptyState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function SinSedeAsignada() {
  useTitulo('Sin sede asignada');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  // Quién la asigna depende del rol: al Recepcionista, un gerente; al
  // Gerente de Sede, el Gerente General.
  const quien = user?.tipoActor === TipoActor.GERENTE_SEDE ? 'El Gerente General' : 'Un gerente';

  return (
    <AuthLayout>
      <EmptyState
        icon={Building2}
        title="Todavía no tenés una sede asignada"
        description={`${quien} debe asignarte una sede antes de que puedas operar. Pedile que lo haga desde el panel de personal y volvé a ingresar.`}
        action={
          <button type="button" className="btn btn-secondary" onClick={() => void handleLogout()}>
            Cerrar sesión
          </button>
        }
      />
    </AuthLayout>
  );
}
