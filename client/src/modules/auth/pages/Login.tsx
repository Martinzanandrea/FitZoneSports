import { type FormEvent, useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { TipoActor } from '../../../shared/types/enums';
import { useNavigate, Link } from 'react-router-dom';
import { AuthInput, AuthLayout } from '../AuthLayout';

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
    <AuthLayout
      photoUrl={esStaff ? '/images/landing/gimnasio-alt.jpg' : '/images/landing/gimnasio-hero.jpg'}
      headline={esStaff ? 'Acceso al panel\nde operaciones.' : 'Entrená\nsin límites.'}
      subheadline={esStaff ? 'Gestioná socios, turnos y métricas en tiempo real.' : 'Tu gimnasio favorito, en la palma de tu mano.'}
      tag={esStaff ? 'Acceso operarios' : undefined}
    >
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)' }}
        >
          <Zap size={20} className="text-white" fill="white" />
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-gray-900">FitZone</p>
          <p className="text-xs text-gray-400 font-medium">
            {esStaff ? 'Panel de gestión' : 'App de socios'}
          </p>
        </div>
      </div>

      <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-1">
        {esStaff ? 'Acceso restringido' : 'Bienvenido de nuevo'}
      </h1>
      <p className="text-sm text-gray-400 font-medium mb-7">
        {esStaff ? 'Ingresá con tus credenciales de operario.' : 'Ingresá para ver tus clases, reservas y más.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Email"
          type="email"
          placeholder="tu@email.com"
          icon={<Mail size={16} />}
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <AuthInput
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          icon={<Lock size={16} />}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          rightEl={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-500 font-medium">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base text-white transition-all active:scale-[0.98] disabled:opacity-70"
          style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)', minHeight: 44 }}
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Ingresar <ArrowRight size={18} className="text-white" />
            </>
          )}
        </button>
      </form>

      {!esStaff ? (
        <div className="text-center space-y-3 mt-6">
          <p className="text-sm text-gray-500">
            ¿No tenés cuenta?{' '}
            <Link to="/registro" className="text-[#8B2EFF] font-bold hover:underline">
              Registrate
            </Link>
          </p>
          <Link
            to="/admin/login"
            className="inline-block text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            Operarios y administradores →
          </Link>
        </div>
      ) : (
        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-[#8B2EFF] font-bold hover:underline">
            ← Volver al acceso de socios
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
