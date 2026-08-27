import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, User, Camera, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { useAuth } from '../../auth/AuthContext';
import { TipoActor } from '../../../shared/types/enums';

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
    } catch (err: any) {
      const mensaje = err?.response?.data?.message;
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

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center px-4 py-10">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <Link to="/" className="relative mb-6 flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft size={15} />
        Volver al inicio
      </Link>

      <div className="relative w-full max-w-[420px] bg-white rounded-2xl p-8 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center justify-center rounded-xl bg-[#8B2EFF] shrink-0 w-12 h-12">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#111111] tracking-tight">Creá tu cuenta</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Sumate a FitZone Sports</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Foto */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-[#F3E8FF] border-2 border-dashed border-[#DDD6FE] overflow-hidden flex items-center justify-center group-hover:border-[#8B2EFF] transition-colors">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Vista previa" className="w-full h-full object-cover" />
                ) : (
                  <User size={26} className="text-[#8B2EFF]/50" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#8B2EFF] flex items-center justify-center border-2 border-white">
                <Camera size={12} className="text-white" />
              </div>
              <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
            </label>
          </div>

          {/* Tipo de actor */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: TipoActor.SOCIO, label: 'Socio' },
              { value: TipoActor.EXTERNO, label: 'Cliente externo' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTipoActor(opt.value)}
                className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  tipoActor === opt.value
                    ? 'bg-[#8B2EFF] text-white border-[#8B2EFF]'
                    : 'bg-white text-[#374151] border-[#E5E7EB] hover:border-[#8B2EFF]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#374151]">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#374151]">Apellido</label>
              <input
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#374151]">DNI</label>
              <input
                required
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#374151]">Teléfono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#374151]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none
                focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#374151]">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#E5E7EB] text-sm outline-none
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#374151]">Confirmar contraseña</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none
                focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
              <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
              <p className="text-xs text-[#DC2626] leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-1 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold
              hover:bg-[#7A25E6] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>

          <p className="text-center text-xs text-[#6B7280]">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="font-semibold text-[#8B2EFF] hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}