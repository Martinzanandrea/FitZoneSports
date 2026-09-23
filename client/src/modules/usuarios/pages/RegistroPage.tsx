import { type FormEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Camera, Eye, EyeOff, Fingerprint, Lock, Mail, Phone, Star, User, Users } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { useAuth } from '../../auth/AuthContext';
import { TipoActor } from '../../../shared/types/enums';
import { AuthInput, AuthLayout } from '../../auth/AuthLayout';

export function RegistroPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

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
  const fileRef = useRef<HTMLInputElement>(null);

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

      // Cuenta creada: logueamos automáticamente para no pedirle que
      // vuelva a escribir sus credenciales una segunda vez.
      await login(email, password);
      if (tipoActor === TipoActor.SOCIO) {
        navigate('/completar-membresia');
      } else {
        navigate('/dashboard');
      }
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
  const strengthColors = ['', '#EF4444', '#F59E0B', '#10B981'];
  const strengthLabels = ['', 'Débil', 'Regular', 'Segura'];

  return (
    <AuthLayout
      photoUrl="/images/landing/yoga-alt.jpg"
      headline={'Empezá hoy.\nTu primera clase\nes gratis.'}
      subheadline="Unite a la comunidad FitZone y accedé a clases, canchas y seguimiento personalizado."
    >
      <div className="flex items-center gap-3 mb-7">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)' }}
        >
          <Star size={20} className="text-white" />
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-gray-900">FitZone</p>
          <p className="text-xs text-gray-400 font-medium">Nueva cuenta</p>
        </div>
      </div>

      <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-1">Creá tu cuenta</h1>
      <p className="text-sm text-gray-400 font-medium mb-6">Solo toma 2 minutos.</p>

      <div className="mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tipo de cuenta</p>
        <div className="grid grid-cols-2 gap-3">
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
              className={`text-left rounded-2xl p-4 border-2 transition-all ${
                tipoActor === opt.id ? 'border-[#8B2EFF] bg-[#8B2EFF]/5' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
              style={{ minHeight: 44 }}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
                  tipoActor === opt.id ? 'bg-[#8B2EFF]' : 'bg-gray-200'
                }`}
              >
                <span className={tipoActor === opt.id ? 'text-white' : 'text-gray-500'}>{opt.icon}</span>
              </div>
              <p className={`text-sm font-black tracking-tight mb-0.5 ${tipoActor === opt.id ? 'text-[#8B2EFF]' : 'text-gray-700'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-400 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Foto de perfil</p>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              {fotoPreview ? (
                <img src={fotoPreview} alt="Vista previa" className="w-full h-full object-cover" />
              ) : (
                <Camera size={20} className="text-gray-300" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#8B2EFF] flex items-center justify-center shadow"
              aria-label="Elegir foto"
            >
              <Camera size={12} className="text-white" />
            </button>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-700">Subí una foto</p>
            <p className="text-xs text-gray-400">JPG o PNG, máx. 5MB</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-[#8B2EFF] font-bold mt-1 hover:underline"
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
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(passStrength / 3) * 100}%`, backgroundColor: strengthColors[passStrength] }}
                />
              </div>
              <span className="text-xs font-bold" style={{ color: strengthColors[passStrength] }}>
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
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-500 font-medium">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base text-white transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
          style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)', minHeight: 44 }}
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Crear cuenta <ArrowRight size={18} className="text-white" />
            </>
          )}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-5">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="text-[#8B2EFF] font-bold hover:underline">
          Ingresá
        </Link>
      </p>
    </AuthLayout>
  );
}
