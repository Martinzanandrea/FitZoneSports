import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usuariosApi } from '../usuarios.api';
import { AuthLayout } from '../../auth/AuthLayout';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function VerificarEmail() {
  useTitulo('Verificá tu email');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [mensajeError, setMensajeError] = useState('');
  const [email, setEmail] = useState('');
  const [reenvando, setReenvando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  useEffect(() => {
    if (!token) {
      setEstado('error');
      setMensajeError('Falta el token de verificación en el link.');
      return;
    }
    usuariosApi
      .verificarEmail(token)
      .then(() => setEstado('ok'))
      .catch((err: unknown) => {
        const ax = err as { response?: { data?: { message?: string | string[] } } };
        const raw = ax.response?.data?.message;
        setMensajeError(Array.isArray(raw) ? raw.join(', ') : (raw ?? 'No se pudo verificar el email.'));
        setEstado('error');
      });
  }, [token]);

  async function handleReenviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setReenvando(true);
    try {
      await usuariosApi.reenviarVerificacion(email);
      setReenviado(true);
    } catch {
      setMensajeError('No se pudo reenviar el email. Intentá de nuevo.');
    } finally {
      setReenvando(false);
    }
  }

  return (
    <AuthLayout
      photoUrl="/images/landing/yoga-alt.jpg"
      headline={'Confirmá\ntu email.'}
      subheadline="Un clic y tu cuenta queda activada."
    >
      {estado === 'cargando' && (
        <div className="text-center">
          <span className="spinner spinner--big" role="status" aria-label="Verificando tu email" />
          <p>Verificando tu email...</p>
        </div>
      )}

      {estado === 'ok' && (
        <div className="text-center">
          <span className="badge badge-success">
            <i />
            Email verificado
          </span>
          <h1>¡Email verificado!</h1>
          <p>Tu cuenta ya está activa. Iniciá sesión para entrar.</p>
          <Link to="/login" className="btn btn-primary full-button">
            Ir a iniciar sesión
          </Link>
        </div>
      )}

      {estado === 'error' && (
        <div className="text-center">
          <span className="badge badge-danger">
            <i />
            No se pudo verificar
          </span>
          <h1>No se pudo verificar</h1>
          <p>{mensajeError}</p>
          {reenviado ? (
            <p>Si el email existe, te enviamos un nuevo link.</p>
          ) : (
            <form onSubmit={handleReenviar}>
              <label className="mail-row">
                <span className="field-label" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </label>
              <button type="submit" disabled={reenvando} className="btn btn-primary full-button">
                {reenvando ? 'Enviando...' : 'Reenviar link'}
              </button>
            </form>
          )}
          <div className="auth-switch">
            <Link to="/login">Volver al login</Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
