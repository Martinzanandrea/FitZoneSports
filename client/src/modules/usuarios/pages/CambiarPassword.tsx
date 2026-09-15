import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, PageHeader } from '../../../shared/components/ui';

const inputClass =
  'w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20';

export function CambiarPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [passwordActual, setPasswordActual] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setExito('');

    if (!user) {
      setError('No hay sesión activa.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await usuariosApi.cambiarPassword(user.id, { passwordActual, password });
      setExito('Contraseña actualizada correctamente.');
      setPasswordActual('');
      setPassword('');
      setConfirmar('');
    } catch (err: unknown) {
      const mensaje =
        err &&
        typeof err === 'object' &&
        'response' in err
          ? (err as { response?: { data?: { message?: unknown } } }).response
              ?.data?.message
          : undefined;
      if (Array.isArray(mensaje)) {
        setError(mensaje[0]);
      } else if (typeof mensaje === 'string') {
        setError(mensaje);
      } else {
        setError('No se pudo cambiar la contraseña. Verificá los datos.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[560px] mx-auto px-4 py-6">
      <PageHeader title="Cambiar contraseña" onBack={() => navigate(-1)} />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#374151]">
              Contraseña actual
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                className={inputClass}
                style={{ minHeight: 44 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                style={{ minHeight: 44, minWidth: 44 }}
                aria-label="Mostrar u ocultar contraseñas"
              >
                {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#374151]">
              Nueva contraseña
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              style={{ minHeight: 44 }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#374151]">
              Confirmar nueva contraseña
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className={inputClass}
              style={{ minHeight: 44 }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
              <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
              <p className="text-xs text-[#DC2626] leading-relaxed">{error}</p>
            </div>
          )}

          {exito && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
              <CheckCircle2 size={15} className="text-[#16A34A] mt-0.5 shrink-0" />
              <p className="text-xs text-[#16A34A] leading-relaxed">{exito}</p>
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
