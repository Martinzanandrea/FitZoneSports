import { Dumbbell } from 'lucide-react';
import type { ReactNode } from 'react';
import '../../styles/auth.css';

// Layout de auth con la piel del diseño (manchas, marca, vidrio).
// Misma API: la lógica de auth vive en cada página.
export function AuthLayout({
  children,
  photoUrl,
  headline,
  subheadline,
  tag,
}: {
  children: ReactNode;
  photoUrl?: string;
  headline?: string;
  subheadline?: string;
  tag?: string;
}) {
  return (
    <div className="auth-shell">
      <div className="ambient ambient-lime" aria-hidden="true" />
      <div className="ambient ambient-aqua" aria-hidden="true" />
      <div className="ambient ambient-coral" aria-hidden="true" />
      <div className="auth-brand">
        <div className="auth-brand-mark">
          <Dumbbell />
        </div>
        <span>
          FITZONE<small>SPORTS</small>
        </span>
      </div>
      {photoUrl ? (
        <div className="auth-split">
          <div className="auth-photo">
            <img src={photoUrl} alt="" aria-hidden="true" />
            {tag && <span className="auth-photo-tag">{tag}</span>}
            <div className="auth-photo-copy">
              <h2>{headline}</h2>
              <p>{subheadline}</p>
            </div>
          </div>
          <div className="auth-card glass">
            <div className="w-full">{children}</div>
          </div>
        </div>
      ) : (
        // Sin foto: tarjeta central (pasos posteriores al login, ej. membresía).
        <div className="auth-card auth-card--narrow auth-card--wide glass">{children}</div>
      )}
    </div>
  );
}

export function AuthInput({
  label,
  type = 'text',
  placeholder,
  icon,
  value,
  onChange,
  rightEl,
  autoComplete,
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  rightEl?: ReactNode;
  autoComplete?: string;
}) {
  return (
    <label className="auth-field">
      <span className="field-label">{label}</span>
      <span className="auth-input-wrap">
        <span className="auth-input-icon" aria-hidden="true">
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`field-input ${icon ? 'auth-input-has-icon' : ''} ${rightEl ? 'auth-input-has-right' : ''}`}
          style={{ minHeight: 44 }}
        />
        {rightEl && <span className="auth-input-right">{rightEl}</span>}
      </span>
    </label>
  );
}
