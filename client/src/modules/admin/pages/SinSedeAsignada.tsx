import { Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export function SinSedeAsignada() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative w-full max-w-[400px] bg-white rounded-2xl p-8 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center rounded-xl bg-[#F3E8FF] shrink-0 w-12 h-12">
            <Building2 size={24} className="text-[#8B2EFF]" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#111111] tracking-tight text-center">
            Todavía no tenés una sede asignada
          </h1>
          <p className="mt-2 text-sm text-[#6B7280] text-center leading-relaxed">
            Un Gerente debe asignarte una sede antes de que puedas operar.
            Pedile que lo haga desde el panel de personal y volvé a ingresar.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold
            hover:bg-[#7A25E6] active:bg-[#6B1FCC]
            transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#8B2EFF]/50"
        >
          Cerrar sesión
        </button>
      </div>

      <p className="mt-6 text-xs text-white/20">© 2026 FitZone Sports. Todos los derechos reservados.</p>
    </div>
  );
}
