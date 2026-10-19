import { CalendarDays, CreditCard, LayoutDashboard, QrCode, UserRound, Volleyball, WalletCards } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import { TipoActor } from '../types/enums';
import { AppShell, type AppShellNavItem } from './AppShell';
import { PushProvider } from '../../modules/notificaciones/components/PushProvider';
import { CampanitaNotificaciones } from '../../modules/notificaciones/components/CampanitaNotificaciones';

const MENU_SOCIO: AppShellNavItem[] = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/mi-qr', label: 'Mi QR', icon: QrCode },
  { to: '/membresia', label: 'Mi membresía', icon: WalletCards },
  { to: '/reservar-clases', label: 'Reservar clases', icon: CalendarDays },
  { to: '/reservar-canchas', label: 'Reservar canchas', icon: Volleyball },
  { to: '/pagos', label: 'Mis pagos', icon: CreditCard },
  { to: '/mi-cuenta', label: 'Mi cuenta', icon: UserRound },
];

const MENU_EXTERNO: AppShellNavItem[] = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/reservar-canchas', label: 'Reservar canchas', icon: Volleyball },
  { to: '/pagos', label: 'Mis pagos', icon: CreditCard },
  { to: '/mi-cuenta', label: 'Mi cuenta', icon: UserRound },
];

// Shell del área cliente, parametrizada por rol para reuso futuro
// (Recepcionista / Gerente de Sede / Gerente General usan el mismo
// AppShell con su propio menú).
export function ClienteShell() {
  const { user } = useAuth();
  if (user?.tipoActor === TipoActor.EXTERNO) {
    return (
      <PushProvider>
        <AppShell eyebrow="FITZONE PLAY" roleLabel="Externo" items={MENU_EXTERNO} />
      </PushProvider>
    );
  }
  // La campanita es solo del Socio: los externos no reciben notificaciones.
  return (
    <PushProvider>
      <AppShell eyebrow="MI FITZONE" roleLabel="Socio" items={MENU_SOCIO} topActions={<CampanitaNotificaciones />} />
    </PushProvider>
  );
}
