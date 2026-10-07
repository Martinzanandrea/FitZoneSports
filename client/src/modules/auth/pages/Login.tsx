import { type FormEvent, useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { usuariosApi } from '../../usuarios/usuarios.api';
import { TipoActor } from '../../../shared/types/enums';
import { membresiasApi } from '../../membresias/membresias.api';
import { useNavigate, Link } from 'react-router-dom';
import { AuthInput, AuthLayout } from '../AuthLayout';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { ROLES_CLIENTE, ROLES_STAFF } from '../../../shared/types/roles';

interface LoginProps {
  // 'cliente' = Socio/Externo, 'staff' = Recepcionista/Gerente
  audience: 'cliente' | 'staff';
  redirectTo: string;
}

export function Login({ audience, redirectTo }: LoginProps) {
  useTitulo('Iniciar sesión');
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

      // El Gerente de Sede tiene su propio panel; el resto va a redirectTo.
      navigate(esStaff && usuario.tipoActor === TipoActor.GERENTE_SEDE ? '/admin/sede' : redirectTo);
    } catch (err: unknown) {
      // Error distinguible del backend cuando las credenciales están bien
      // pero el email todavía no fue verificado (ver auth.service.ts).
      const ax = err as { response?: { status?: number; data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      if (msg === 'EMAIL_NO_VERIFICADO') {
        setEmailSinVerificar(true);
        setError('Todavía no verificaste tu email');
      } else if (ax.response?.status === 429) {
        // El backend limita el login por IP; no es un error de credenciales.
        setError('Demasiados intentos. Esperá un minuto y volvé a probar.');
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
      <Link to="/" className="back-link">
        <ArrowLeft size={15} />
        Volver al inicio
      </Link>

      <span className="eyebrow">{esStaff ? 'ACCESO OPERARIOS' : 'BIENVENIDO DE NUEVO'}</span>
      <h1>{esStaff ? 'Acceso restringido' : 'Bienvenido de nuevo'}</h1>
      <p>
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
          <div>
            <span className="badge badge-danger">
              <i />
              {error}
            </span>
            {emailSinVerificar && (
              <div>
                <button
                  type="button"
                  onClick={handleReenviar}
                  disabled={reenvando}
                  className="btn btn-ghost"
                >
                  {reenvando ? 'Enviando...' : 'Reenviar email de verificación'}
                </button>
              </div>
            )}
          </div>
        )}
        {reMensaje && <p>{reMensaje}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary full-button">
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <>
              Ingresar <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      {!esStaff ? (
        <div className="auth-switch">
          <span>¿No tenés cuenta?</span>
          <Link to="/registro">Registrate</Link>
          <Link to="/admin/login">Operarios y administradores →</Link>
        </div>
      ) : (
        <div className="auth-switch">
          <Link to="/login">← Volver al acceso de socios</Link>
        </div>
      )}
    </AuthLayout>
  );
}
