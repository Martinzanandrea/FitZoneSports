import {
  Banknote,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  GraduationCap,
  QrCode,
  ScanLine,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import { TipoActor } from '../types/enums';
import { AppShell, type AppShellNavItem } from '../layout/AppShell';
import '../../styles/operarios.css';

interface MenuAdminItem extends AppShellNavItem {
  /** false = ítem preparado pero todavía oculto. */
  visible?: boolean;
}

// Menús del área de operarios, definidos en un solo lugar. El backend es la
// autoridad: ocultar un ítem es solo UX.
const MENU_RECEPCION: MenuAdminItem[] = [
  { to: '/admin/recepcion', label: 'Recepción', icon: QrCode },
  { to: '/admin/acceso', label: 'Control de acceso', icon: ScanLine },
  { to: '/admin/acceso/dentro', label: 'Quién está dentro', icon: UserCheck },
  { to: '/admin/cobrar', label: 'Cobrar', icon: Banknote },
  { to: '/admin/reservas-clases', label: 'Reservas de clases', icon: Calendar },
  { to: '/admin/reservas-canchas', label: 'Reservas de canchas', icon: CalendarCheck },
];

// Gerente de Sede: todo lo de su sede, sin Precios ni Sedes.
const MENU_SEDE: MenuAdminItem[] = [
  { to: '/admin/sede', label: 'Panel', icon: TrendingUp },
  { to: '/admin/personal', label: 'Personal', icon: Users },
  { to: '/admin/canchas', label: 'Canchas', icon: ScanLine },
  { to: '/admin/clases', label: 'Clases', icon: BookOpen },
  { to: '/admin/instructores', label: 'Instructores', icon: GraduationCap },
  { to: '/admin/membresias', label: 'Membresías', icon: CreditCard },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/acceso', label: 'Control de acceso', icon: QrCode },
  { to: '/admin/cobrar', label: 'Cobrar', icon: Banknote },
  { to: '/admin/reportes', label: 'Reportes', icon: TrendingUp },
];

const MENU_GENERAL: MenuAdminItem[] = [
  { to: '/admin/gerente', label: 'Panel', icon: TrendingUp },
  { to: '/admin/personal', label: 'Personal', icon: Users },
  { to: '/admin/sedes', label: 'Sedes', icon: Building2 },
  { to: '/admin/canchas', label: 'Canchas', icon: ScanLine },
  { to: '/admin/clases', label: 'Clases', icon: BookOpen },
  { to: '/admin/instructores', label: 'Instructores', icon: GraduationCap },
  { to: '/admin/membresias', label: 'Membresías', icon: CreditCard },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/reportes', label: 'Reportes', icon: TrendingUp },
  { to: '/admin/precios', label: 'Precios', icon: Tag },
];

function configuracionPorRol(tipo: string | undefined) {
  switch (tipo) {
    case TipoActor.GERENTE_GENERAL:
      return { eyebrow: 'Panel general', roleLabel: 'Gerente general', items: MENU_GENERAL };
    case TipoActor.GERENTE_SEDE:
      return { eyebrow: 'Panel de sede', roleLabel: 'Gerente de sede', items: MENU_SEDE };
    default:
      return { eyebrow: 'Panel de recepción', roleLabel: 'Recepcionista', items: MENU_RECEPCION };
  }
}

export function AdminLayout() {
  const { user } = useAuth();
  const { eyebrow, roleLabel, items } = configuracionPorRol(user?.tipoActor);
  return (
    <AppShell
      eyebrow={eyebrow}
      roleLabel={roleLabel}
      items={items.filter((i) => i.visible !== false)}
      accountTo={null}
      logoutTo="/admin/login"
    />
  );
}
