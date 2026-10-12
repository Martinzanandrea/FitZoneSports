import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Dumbbell, LogOut, Menu, UserRound, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';

export interface AppShellNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface AppShellProps {
  /** Texto corto sobre el nombre del rol (ej. "MI FITZONE"). */
  eyebrow: string;
  /** Nombre del rol (ej. "Socio"). */
  roleLabel: string;
  /** Ítems del menú lateral. */
  items: AppShellNavItem[];
  /** Ruta de "Mi cuenta" en el menú de usuario; null la oculta (default: /mi-cuenta). */
  accountTo?: string | null;
  /** A dónde ir al cerrar sesión (default: /login). */
  logoutTo?: string;
  /** Acciones extra en el header, antes del menú de usuario (ej. la campanita). */
  topActions?: ReactNode;
}

function inicialesDe(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase();
}

interface SidebarContentProps {
  eyebrow: string;
  roleLabel: string;
  items: AppShellNavItem[];
  actualTo: string;
  iniciales: string;
  nombreCompleto: string;
  onClose?: () => void;
  onNavegar: () => void;
}

function SidebarContent({ eyebrow, roleLabel, items, actualTo, iniciales, nombreCompleto, onClose, onNavegar }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <Dumbbell />
        </div>
        <span>
          FITZONE<small>SPORTS</small>
        </span>
        {onClose && (
          <button className="icon-button" onClick={onClose} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="sidebar-context">
        <span>{eyebrow}</span>
        <strong>{roleLabel}</strong>
      </div>

      <nav aria-label={roleLabel}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavegar}
            className={actualTo === item.to ? 'active' : ''}
          >
            <item.icon size={19} aria-hidden />
            <span>{item.label}</span>
            {actualTo === item.to && <i aria-hidden />}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-line">
          <span className="avatar" aria-hidden>
            {iniciales}
          </span>
          <span>
            <strong>
              {nombreCompleto}
            </strong>
            <small>{roleLabel}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ eyebrow, roleLabel, items, accountTo = '/mi-cuenta', logoutTo = '/login', topActions }: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ítem activo: el de ruta más larga que prefija la ubicación actual
  // (así /admin/clases/:id sigue marcando "Clases").
  const actual =
    items
      .filter((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0] ?? items[0];
  const iniciales = user ? inicialesDe(user.nombre, user.apellido) : '';
  const nombreCompleto = `${user?.nombre ?? ''} ${user?.apellido ?? ''}`;

  // Al navegar se cierran drawer y menú de usuario. Se ajusta durante el render
  // (patrón recomendado por React) en lugar de un efecto con setState.
  const [rutaPrevia, setRutaPrevia] = useState(location.pathname);
  if (rutaPrevia !== location.pathname) {
    setRutaPrevia(location.pathname);
    setDrawer(false);
    setMenuAbierto(false);
  }

  useEffect(() => {
    if (!menuAbierto) return;
    function alClickAfuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAbierto(false);
    }
    document.addEventListener('mousedown', alClickAfuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClickAfuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [menuAbierto]);

  async function handleLogout() {
    await logout();
    navigate(logoutTo);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawer ? 'drawer-open' : ''}`} aria-label="Menú principal">
        <SidebarContent
          eyebrow={eyebrow}
          roleLabel={roleLabel}
          items={items}
          actualTo={actual.to}
          iniciales={iniciales}
          nombreCompleto={nombreCompleto}
          onClose={() => setDrawer(false)}
          onNavegar={() => setDrawer(false)}
        />
      </aside>

      {drawer && (
        <button className="drawer-backdrop" aria-label="Cerrar menú" onClick={() => setDrawer(false)} />
      )}

      <div className="main-area">
        <header className="topbar glass">
          <button className="icon-button" aria-label="Abrir menú" onClick={() => setDrawer(true)}>
            <Menu size={20} />
          </button>
          <div className="page-title">
            <span>{eyebrow}</span>
            <h1>{actual.label}</h1>
          </div>
          <div className="top-actions" ref={menuRef}>
            {topActions}
            <button
              className="user-menu"
              aria-label="Menú de usuario"
              aria-expanded={menuAbierto}
              aria-haspopup="menu"
              onClick={() => setMenuAbierto((v) => !v)}
            >
              <span aria-hidden>{iniciales}</span>
              <span>
                <strong>
                  {user?.nombre} {user?.apellido}
                </strong>
                <small>{roleLabel}</small>
              </span>
              <ChevronDown size={16} aria-hidden />
            </button>
            {menuAbierto && (
              <div className="user-dropdown" role="menu">
                {accountTo && (
                  <button role="menuitem" onClick={() => navigate(accountTo)}>
                    <UserRound size={16} aria-hidden /> Mi cuenta
                  </button>
                )}
                <button role="menuitem" className="danger" onClick={() => void handleLogout()}>
                  <LogOut size={16} aria-hidden /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
