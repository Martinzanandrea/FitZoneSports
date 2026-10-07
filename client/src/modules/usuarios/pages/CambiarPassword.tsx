import { type FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { useAuth } from '../../auth/AuthContext';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import '../../../styles/auth.css';

const inputClass =
  'field-input auth-input-has-right';

// Sección reutilizable (misma lógica que la pantalla standalone original,
// ahora montada dentro de Configuración). Sin chrome de página propio.
export function CambiarPasswordForm() {
  useTitulo('Cambiar contraseña');
  const { user } = useAuth();

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
    <div className="auth-card--narrow auth-card--embedded" style={{ maxWidth: 420 }}>
      <span className="eyebrow">SEGURIDAD</span>
      <h1>Cambiar contraseña</h1>
      <p>Escribí tu contraseña actual y la nueva.</p>

      <form onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="field-label">CONTRASEÑA ACTUAL</span>
          <span className="auth-input-wrap">
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              style={{ minHeight: 44 }}
            />
            <span className="auth-input-right">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPasswords(!showPasswords)}
                aria-label="Mostrar u ocultar contraseñas"
              >
                {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </span>
        </label>

        <label className="auth-field">
          <span className="field-label">NUEVA CONTRASEÑA</span>
          <input
            type={showPasswords ? 'text' : 'password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            autoComplete="new-password"
            style={{ minHeight: 44 }}
          />
        </label>

        <label className="auth-field">
          <span className="field-label">CONFIRMAR NUEVA CONTRASEÑA</span>
          <input
            type={showPasswords ? 'text' : 'password'}
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="field-input"
            autoComplete="new-password"
            style={{ minHeight: 44 }}
          />
        </label>

        {error && (
          <span className="badge badge-danger">
            <i />
            {error}
          </span>
        )}

        {exito && (
          <span className="badge badge-success">
            <i />
            {exito}
          </span>
        )}

        <button type="submit" className="btn btn-primary full-button" disabled={loading}>
          {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  );
}
