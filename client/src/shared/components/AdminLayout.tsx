/* eslint-disable react-hooks/static-components */
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Menu, LogOut, Zap, Users, Building2, ScanLine, BookOpen, CreditCard, TrendingUp, QrCode, Calendar, CalendarCheck, Banknote, ClipboardList, GraduationCap, Tag } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import { TipoActor } from '../../shared/types/enums';

const MANAGER_NAV = [
  { to: '/admin/gerente', icon: TrendingUp, label: 'Panel' },
  { to: '/admin/personal', icon: Users, label: 'Personal' },
  { to: '/admin/sedes', icon: Building2, label: 'Sedes' },
  { to: '/admin/canchas', icon: ScanLine, label: 'Canchas' },
  { to: '/admin/clases', icon: BookOpen, label: 'Clases' },
  { to: '/admin/instructores', icon: GraduationCap, label: 'Instructores' },
  { to: '/admin/membresias', icon: CreditCard, label: 'Membresías' },
  { to: '/admin/reservas', icon: ClipboardList, label: 'Reservas' },
  { to: '/admin/precios', icon: Tag, label: 'Precios' },
];

const RECEPTION_NAV = [
  { to: '/admin/recepcion', icon: QrCode, label: 'Panel' },
  { to: '/admin/acceso', icon: QrCode, label: 'Control de acceso' },
  { to: '/admin/instructores', icon: GraduationCap, label: 'Instructores' },
  { to: '/admin/reservas-clases', icon: Calendar, label: 'Reservas de clases' },
  { to: '/admin/reservas-canchas', icon: CalendarCheck, label: 'Reservas de canchas' },
  { to: '/admin/cobrar', icon: Banknote, label: 'Cobrar en efectivo' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navItems = user?.tipoActor === TipoActor.GERENTE ? MANAGER_NAV : RECEPTION_NAV;
  const iniciales = user ? `${user.nombre[0]}${user.apellido[0]}` : '';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.08]">
        <div className="flex items-center justify-center rounded-xl bg-[#8B2EFF] shrink-0 w-8 h-8">
          <Zap size={16} className="text-white" fill="white" />
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight">FitZone</p>
          <p className="text-[#8B2EFF] text-[11px] font-medium leading-tight">Admin</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-150 focus:outline-none ${
                isActive
                  ? 'bg-[#8B2EFF] text-white shadow-lg shadow-[#8B2EFF]/30'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
              }`
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#8B2EFF]/30 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-[#8B2EFF]">{iniciales}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">
              {user?.nombre} {user?.apellido}
            </p>
            <p className="text-white/40 text-[11px] truncate">{user?.tipoActor}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/40
            hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 focus:outline-none"
        >
          <LogOut size={15} />
          Salir
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
      <aside className="hidden md:flex flex-col w-60 bg-[#0A0A0A] shrink-0 overflow-hidden">
        <SidebarContent />
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-[#0A0A0A] z-30 md:hidden
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0A0A0A] border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="text-white/70 hover:text-white transition-colors p-1"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl bg-[#8B2EFF] shrink-0 w-6 h-6">
              <Zap size={12} className="text-white" fill="white" />
            </div>
            <span className="text-white text-sm font-bold">FitZone Admin</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}