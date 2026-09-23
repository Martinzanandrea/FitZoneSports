import { NavLink, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';

export function ClienteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const iniciales = user ? `${user.nombre[0]}${user.apellido[0]}` : '';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 h-[60px] bg-[#0A0A0A] border-b border-white/[0.06]">
      <NavLink to="/dashboard" className="flex items-center gap-2 min-w-0" style={{ minHeight: 44 }}>
        <div className="flex items-center justify-center rounded-lg font-black text-white text-sm w-8 h-8 bg-[#8B2EFF]">FZ</div>
        <span className="font-bold text-base text-white hidden sm:block tracking-tight">FitZone Sports</span>
      </NavLink>

      <nav className="hidden md:flex items-center gap-1">
        {[
          { to: '/dashboard', label: 'Inicio' },
          { to: '/reservar-clases', label: 'Clases' },
          { to: '/reservar-canchas', label: 'Canchas' },
        ].map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `px-4 h-9 flex items-center rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'text-[#8B2EFF] bg-[#F3E8FF]/10' : 'text-white/60 hover:text-white'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <NavLink
          to="/mi-cuenta/password"
          title="Cambiar contraseña"
          aria-label="Cambiar contraseña"
          className={({ isActive }) =>
            `flex items-center justify-center rounded-lg transition-colors ${
              isActive ? 'text-[#8B2EFF] bg-[#F3E8FF]/10' : 'text-white/50 hover:text-white'
            }`
          }
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <Settings size={18} />
        </NavLink>
        <div className="flex items-center justify-center rounded-full font-bold text-sm text-white w-9 h-9 bg-[#8B2EFF]" style={{ minHeight: 44, minWidth: 44 }}>
          {iniciales}
        </div>
        <button
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 h-9 text-white/50 border border-white/[0.08] hover:text-white transition-colors"
        >
          Salir
        </button>
      </div>
    </header>
  );
}