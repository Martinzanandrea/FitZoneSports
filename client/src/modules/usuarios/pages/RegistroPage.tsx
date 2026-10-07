import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Eye, EyeOff, Fingerprint, Lock, Mail, Phone, Star, User, Users } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { TipoActor } from '../../../shared/types/enums';
import { AuthInput, AuthLayout } from '../../auth/AuthLayout';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function RegistroPage() {
  useTitulo('Creá tu cuenta');
  const [registradoEmail, setRegistradoEmail] = useState<string | null>(null);

  const [tipoActor, setTipoActor] = useState<string>(TipoActor.SOCIO);
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [reenvando, setReenvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFoto(file);
    setFotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('tipoActor', tipoActor);
      formData.append('dni', dni);
      formData.append('nombre', nombre);
      formData.append('apellido', apellido);
      formData.append('email', email);
      formData.append('password', password);
      if (telefono) formData.append('telefono', telefono);
      if (foto) formData.append('foto', foto);

      await usuariosApi.registrarPublico(formData);

      // La cuenta queda sin verificar: no se puede loguear todavía.
      // Se muestra la pantalla de "revisá tu email" en vez de redirigir.
      setRegistradoEmail(email);
    } catch (err: unknown) {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;
      if (Array.isArray(mensaje)) {
        setError(mensaje[0]);
      } else if (typeof mensaje === 'string') {
        setError(mensaje);
      } else {
        setError('No se pudo completar el registro. Verificá los datos.');
      }
    } finally {
      setLoading(false);
    }
  }

  const passStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', 'var(--coral)', 'var(--warning)', 'var(--success)'];
  const strengthLabels = ['', 'Débil', 'Regular', 'Segura'];

  async function handleReenviar() {
    if (!registradoEmail || cooldown > 0) return;
    setReenvando(true);
    try {
      await usuariosApi.reenviarVerificacion(registradoEmail);
      setCooldown(30);
    } catch {
      setError('No se pudo reenviar el email. Intentá de nuevo.');
    } finally {
      setReenvando(false);
    }
  }

  if (registradoEmail) {
    return (
      <AuthLayout
        photoUrl="/images/landing/yoga-alt.jpg"
        headline={'Ya casi estás.\nRevisá tu email.'}
        subheadline="Te mandamos un link para confirmar tu cuenta."
      >
        <div className="text-center">
          <h1>Revisá tu email</h1>
          <p>
            Te enviamos un link de verificación a
          </p>
          <p>
            <strong>{registradoEmail}</strong>
          </p>
          <p>
            Hacé clic en el link para activar tu cuenta y después iniciá sesión.
            Si no lo ves, revisá el spam.
          </p>
          {error && (
            <span className="badge badge-danger">
              <i />
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={handleReenviar}
            disabled={reenvando || cooldown > 0}
            className="btn btn-primary full-button"
          >
            {reenvando ? 'Enviando...' : cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar email'}
          </button>
          <div className="auth-switch">
            <Link to="/login">Ir a iniciar sesión</Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      photoUrl="/images/landing/yoga-alt.jpg"
      headline={'Empezá hoy.\nTu primera clase\nes gratis.'}
      subheadline="Unite a la comunidad FitZone y accedé a clases, canchas y seguimiento personalizado."
    >
      <Link to="/" className="back-link">
        <ArrowLeft size={15} />
        Volver al inicio
      </Link>

      <span className="eyebrow">CREÁ TU CUENTA</span>
      <h1>Creá tu cuenta</h1>
      <p>Solo toma 2 minutos.</p>

      <div>
        <span className="field-label">TIPO DE CUENTA</span>
        <div className="account-pick">
          {(
            [
              { id: TipoActor.SOCIO, icon: <Star size={16} />, label: 'Socio', desc: 'Membresía activa, acceso completo' },
              { id: TipoActor.EXTERNO, icon: <Users size={16} />, label: 'Cliente externo', desc: 'Clases y canchas sueltas' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTipoActor(opt.id)}
              aria-pressed={tipoActor === opt.id}
            >
              <span className="account-pick-icon">{opt.icon}</span>
              <strong>{opt.label}</strong>
              <span>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">FOTO DE PERFIL</span>
        <div className="photo-pick">
          <button
            type="button"
            className="photo-circle"
            onClick={() => fileRef.current?.click()}
            aria-label="Elegir foto"
          >
            {fotoPreview ? (
              <img src={fotoPreview} alt="Vista previa" />
            ) : (
              <Camera size={20} />
            )}
          </button>
          <div>
            <p>
              <strong>Subí una foto</strong>
            </p>
            <p>JPG o PNG, máx. 5MB</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn btn-ghost"
            >
              Elegir archivo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AuthInput label="Nombre" placeholder="Lucas" icon={<User size={16} />} value={nombre} onChange={setNombre} />
          <AuthInput label="Apellido" placeholder="Fernández" icon={<User size={16} />} value={apellido} onChange={setApellido} />
        </div>
        <AuthInput label="DNI" placeholder="38.421.000" icon={<Fingerprint size={16} />} value={dni} onChange={setDni} />
        <AuthInput label="Email" type="email" placeholder="tu@email.com" icon={<Mail size={16} />} value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput label="Teléfono (opcional)" placeholder="11 5555 5555" icon={<Phone size={16} />} value={telefono} onChange={setTelefono} autoComplete="tel" />
        <div>
          <AuthInput
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            icon={<Lock size={16} />}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            rightEl={
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          {password.length > 0 && (
            <div className="strength" aria-live="polite">
              <div className="strength-track">
                <i
                  style={{ width: `${(passStrength / 3) * 100}%`, backgroundColor: strengthColors[passStrength] }}
                />
              </div>
              <span style={{ color: strengthColors[passStrength] }}>
                {strengthLabels[passStrength]}
              </span>
            </div>
          )}
        </div>
        <AuthInput
          label="Confirmar contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="Repetí tu contraseña"
          icon={<Lock size={16} />}
          value={confirmarPassword}
          onChange={setConfirmarPassword}
          autoComplete="new-password"
        />
        {error && (
          <span className="badge badge-danger">
            <i />
            {error}
          </span>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary full-button">
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <>
              Crear cuenta <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="auth-switch">
        <span>¿Ya tenés cuenta?</span>
        <Link to="/login">Ingresá</Link>
      </div>
    </AuthLayout>
  );
}
