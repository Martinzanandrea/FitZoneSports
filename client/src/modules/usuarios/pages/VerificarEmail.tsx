import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { AuthLayout } from '../../auth/AuthLayout';

export function VerificarEmail() {
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
        <div className="text-center py-8">
          <span className="inline-block w-8 h-8 border-2 border-[#8B2EFF]/30 border-t-[#8B2EFF] rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium mt-4">Verificando tu email...</p>
        </div>
      )}

      {estado === 'ok' && (
        <div className="text-center">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)' }}
          >
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-2">¡Email verificado!</h1>
          <p className="text-sm text-gray-400 font-medium mb-6">Tu cuenta ya está activa. Iniciá sesión para entrar.</p>
          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base text-white transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)', minHeight: 44 }}
          >
            Ir a iniciar sesión
          </Link>
        </div>
      )}

      {estado === 'error' && (
        <div className="text-center">
          <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={20} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-2">No se pudo verificar</h1>
          <p className="text-sm text-gray-400 font-medium mb-6">{mensajeError}</p>
          {reenviado ? (
            <p className="text-sm text-gray-500">Si el email existe, te enviamos un nuevo link.</p>
          ) : (
            <form onSubmit={handleReenviar} className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 focus-within:border-[#8B2EFF] focus-within:bg-white transition-all">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full py-3.5 bg-transparent text-sm font-medium outline-none placeholder:text-gray-300"
                  style={{ minHeight: 44 }}
                />
              </div>
              <button
                type="submit"
                disabled={reenvando}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base text-white transition-all active:scale-[0.98] disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)', minHeight: 44 }}
              >
                {reenvando ? 'Enviando...' : 'Reenviar link'}
              </button>
            </form>
          )}
          <p className="text-sm text-gray-500 text-center mt-5">
            <Link to="/login" className="text-[#8B2EFF] font-bold hover:underline">
              Volver al login
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
