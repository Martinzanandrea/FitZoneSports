import { type FormEvent, useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Zap, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { usuariosApi } from '../../usuarios/usuarios.api';
import { TipoActor } from '../../../shared/types/enums';
import { membresiasApi } from '../../membresias/membresias.api';
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
  const [emailSinVerificar, setEmailSinVerificar] = useState(false);
  const [reenvando, setReenvando] = useState(false);
  const [reMensaje, setReMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const rolesPermitidos = audience === 'staff' ? ROLES_STAFF : ROLES_CLIENTE;
  const esStaff = audience === 'staff';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEmailSinVerificar(false);
    setReMensaje('');
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

      // ADR 0011: un Socio sin membresía ACTIVA (nuevo, vencido o
      // suspendido por pago rechazado) debe completar plan+pago antes
      // de usar la app. Solo SOCIO pasa por este chequeo.
      if (usuario.tipoActor === TipoActor.SOCIO) {
        const vigente = await membresiasApi
          .getVigente(usuario.id)
          .catch(() => null);
        if (!vigente || vigente.estado !== 'ACTIVO') {
          navigate('/completar-membresia');
          return;
        }
      }

      navigate(redirectTo);
    } catch (err: unknown) {
      // Error distinguible del backend cuando las credenciales están bien
      // pero el email todavía no fue verificado (ver auth.service.ts).
      const ax = err as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      if (msg === 'EMAIL_NO_VERIFICADO') {
        setEmailSinVerificar(true);
        setError('Todavía no verificaste tu email');
      } else {
        setError('Email o contraseña incorrectos.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviar() {
    if (!email) return;
    setReenvando(true);
    try {
      await usuariosApi.reenviarVerificacion(email);
      setReMensaje('Si el email existe, te enviamos un nuevo link.');
    } catch {
      setReMensaje('No se pudo reenviar. Intentá de nuevo.');
    } finally {
      setReenvando(false);
    }
  }

  return (
    <AuthLayout
      photoUrl={esStaff ? '/images/landing/gimnasio-alt.jpg' : '/images/landing/gimnasio-hero.jpg'}
      headline={esStaff ? 'Acceso al panel\nde operaciones.' : 'Entrená\nsin límites.'}
      subheadline={esStaff ? 'Gestioná socios, turnos y métricas en tiempo real.' : 'Tu gimnasio favorito, en la palma de tu mano.'}
      tag={esStaff ? 'Acceso operarios' : undefined}
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
        style={{ minHeight: 44 }}
      >
        <ArrowLeft size={15} />
        Volver al inicio
      </Link>
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
            <div>
              <p className="text-xs text-red-500 font-medium">{error}</p>
              {emailSinVerificar && (
                <button
                  type="button"
                  onClick={handleReenviar}
                  disabled={reenvando}
                  className="text-xs text-[#8B2EFF] font-bold hover:underline mt-1 disabled:opacity-60"
                >
                  {reenvando ? 'Enviando...' : 'Reenviar email de verificación'}
                </button>
              )}
            </div>
          </div>
        )}
        {reMensaje && <p className="text-xs text-gray-500 font-medium">{reMensaje}</p>}
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
