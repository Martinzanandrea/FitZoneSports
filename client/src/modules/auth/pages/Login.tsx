import { type FormEvent, useState } from 'react';
import { Eye, EyeOff, AlertCircle, Zap } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { TipoActor } from '../../../shared/types/enums';
import { useNavigate, Link } from 'react-router-dom';

interface LoginProps {
  // 'cliente' = Socio/Externo, 'staff' = Recepcionista/Gerente
  audience: 'cliente' | 'staff';
  redirectTo: string;
}

const ROLES_STAFF: TipoActor[] = [TipoActor.RECEPCIONISTA, TipoActor.GERENTE];
const ROLES_CLIENTE: TipoActor[] = [TipoActor.SOCIO, TipoActor.EXTERNO];

export function Login({ audience, redirectTo }: LoginProps) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rolesPermitidos = audience === 'staff' ? ROLES_STAFF : ROLES_CLIENTE;
  const esStaff = audience === 'staff';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const usuario = await login(email, password);

      // Las credenciales son válidas, pero ¿corresponden a esta puerta?
      // Un socio no puede entrar por /admin/login, y viceversa.
      if (!rolesPermitidos.includes(usuario.tipoActor)) {
        await logout();
        setError(
          esStaff
            ? 'Este acceso es solo para personal de FitZone.'
            : 'Este acceso es solo para socios y clientes. Si sos personal, usá el acceso de staff.',
        );
        return;
      }

      navigate(redirectTo);
    } catch {
      setError('Email o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
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

      <div className="relative w-full max-w-[340px] bg-white rounded-2xl p-8 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center rounded-xl bg-[#8B2EFF] shrink-0 w-12 h-12">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#111111] tracking-tight">FitZone Sports</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            {esStaff ? 'Acceso de personal' : 'Plataforma de gestión'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-[#374151]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#111111]
                placeholder:text-[#9CA3AF] outline-none transition-all duration-150
                focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-[#374151]">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#111111]
                  placeholder:text-[#9CA3AF] outline-none transition-all duration-150
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
              <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
              <p className="text-xs text-[#DC2626] leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold
              hover:bg-[#7A25E6] active:bg-[#6B1FCC] disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#8B2EFF]/50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Ingresando…
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>
        {audience === 'cliente' && (
          <div className="mt-6 pt-5 border-t border-[#E5E7EB] text-center">
            <Link
              to="/admin/login"
              className="text-xs text-[#6B7280] hover:text-[#8B2EFF] transition-colors"
            >
              Operarios y administradores →
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-white/20">© 2026 FitZone Sports. Todos los derechos reservados.</p>
    </div>
  );
}