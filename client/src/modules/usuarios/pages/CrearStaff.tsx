import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, Users, X } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import type { CrearStaffPayload, Usuario } from '../usuarios.types';
import { TipoActor } from '../../../shared/types/enums';

export function CrearStaff() {
  const [form, setForm] = useState<CrearStaffPayload>({
    tipoActor: TipoActor.RECEPCIONISTA,
    nombre: '',
    apellido: '',
    email: '',
    password: '',
  });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [rolSeleccionado, setRolSeleccionado] = useState<typeof TipoActor.RECEPCIONISTA | typeof TipoActor.GERENTE>(TipoActor.RECEPCIONISTA);
  const [passwordRol, setPasswordRol] = useState('');

  useEffect(() => {
    usuariosApi.getAll().then(setUsuarios).catch(() => setError('No se pudieron cargar los usuarios.'));
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return usuarios;
    return usuarios.filter((usuario) =>
      `${usuario.nombre} ${usuario.apellido} ${usuario.email} ${usuario.dni ?? ''}`.toLowerCase().includes(texto),
    );
  }, [busqueda, usuarios]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setSubmitting(true);
    try {
      const usuario = await usuariosApi.crearStaff(form);
      setMensaje(`${usuario.nombre} ${usuario.apellido} creado como ${usuario.tipoActor}`);
      setForm({ tipoActor: TipoActor.RECEPCIONISTA, nombre: '', apellido: '', email: '', password: '' });
      setUsuarios((current) => [...current, usuario]);
    } catch {
      setError('No se pudo crear el usuario. Revisá los datos.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAsignarRol(event: FormEvent) {
    event.preventDefault();
    if (!usuarioSeleccionado) return;
    setMensaje(null);
    setError(null);
    setSubmitting(true);
    try {
      const usuarioActualizado = await usuariosApi.asignarRol(usuarioSeleccionado.id, rolSeleccionado, passwordRol);
      setUsuarios((current) => current.map((usuario) => usuario.id === usuarioActualizado.id ? usuarioActualizado : usuario));
      setUsuarioSeleccionado(usuarioActualizado);
      setPasswordRol('');
      setMensaje(`${usuarioActualizado.nombre} ${usuarioActualizado.apellido} ahora es ${usuarioActualizado.tipoActor}`);
    } catch {
      setError('No se pudo asignar el rol. La contraseña debe tener al menos 8 caracteres.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'mt-1.5 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20';
  const labelClass = 'text-sm font-medium text-[#374151]';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#8B2EFF]">Administración</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Personal</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Buscá usuarios y administrá sus permisos de acceso.</p>
        </div>
        <button type="button" onClick={() => setUsuarioSeleccionado(null)} className="inline-flex items-center gap-2 rounded-xl bg-[#8B2EFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7620df] focus:outline-none focus:ring-2 focus:ring-[#8B2EFF]/30">
          <UserPlus size={16} /> Crear usuario
        </button>
      </div>

      {mensaje && <p className="mb-4 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm text-[#15803D]">{mensaje}</p>}
      {error && <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

      <section className="mb-5 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="border-b border-[#F3F4F6] p-5">
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, email o DNI..." className="w-full rounded-xl border border-[#D1D5DB] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20" />
          </div>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {usuariosFiltrados.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#6B7280]">No se encontraron usuarios.</div>
          ) : usuariosFiltrados.map((usuario) => (
            <button type="button" key={usuario.id} onClick={() => { setUsuarioSeleccionado(usuario); setRolSeleccionado(usuario.tipoActor === TipoActor.GERENTE ? TipoActor.GERENTE : TipoActor.RECEPCIONISTA); }} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#FAF7FF] ${usuarioSeleccionado?.id === usuario.id ? 'bg-[#FAF7FF]' : ''}`}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-xs font-bold text-[#8B2EFF]">{usuario.nombre[0]}{usuario.apellido[0]}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#111111]">{usuario.nombre} {usuario.apellido}</span><span className="block truncate text-xs text-[#6B7280]">{usuario.email}</span></span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${usuario.tipoActor === TipoActor.GERENTE ? 'bg-[#F3E8FF] text-[#7E22CE]' : 'bg-[#EFF6FF] text-[#1D4ED8]'}`}>{usuario.tipoActor}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#111111]"><UserPlus size={18} className="text-[#8B2EFF]" /> Crear usuario nuevo</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Nombre<input className={inputClass} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
            <label className={labelClass}>Apellido<input className={inputClass} value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required /></label>
            <label className={labelClass}>Email<input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label className={labelClass}>Rol<select className={inputClass} value={form.tipoActor} onChange={(e) => setForm({ ...form, tipoActor: e.target.value as CrearStaffPayload['tipoActor'] })}><option value={TipoActor.RECEPCIONISTA}>Recepcionista</option><option value={TipoActor.GERENTE}>Gerente</option></select></label>
            <label className={`${labelClass} sm:col-span-2`}>Contraseña<input className={inputClass} type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          </div>
          <button type="submit" disabled={submitting} className="mt-5 w-full rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#292929] disabled:opacity-50">{submitting ? 'Creando...' : 'Crear usuario'}</button>
        </form>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#111111]"><Users size={18} className="text-[#8B2EFF]" /> Asignar rol</h2>
          {usuarioSeleccionado ? <form onSubmit={handleAsignarRol} className="mt-5 space-y-4"><p className="rounded-lg bg-[#FAF7FF] p-3 text-sm text-[#374151]">Usuario: <strong>{usuarioSeleccionado.nombre} {usuarioSeleccionado.apellido}</strong></p><label className={labelClass}>Nuevo rol<select className={inputClass} value={rolSeleccionado} onChange={(e) => setRolSeleccionado(e.target.value as typeof rolSeleccionado)}><option value={TipoActor.RECEPCIONISTA}>Recepcionista</option><option value={TipoActor.GERENTE}>Gerente</option></select></label><label className={labelClass}>Contraseña de acceso<input className={inputClass} type="password" minLength={8} required value={passwordRol} onChange={(e) => setPasswordRol(e.target.value)} /></label><div className="flex items-center justify-center gap-2 pt-4"><button type="submit" disabled={submitting} className="rounded-lg bg-[#8B2EFF] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Guardando...' : 'Asignar rol'}</button><button type="button" onClick={() => setUsuarioSeleccionado(null)} className="rounded-lg border border-[#D1D5DB] px-3 py-2.5 text-[#6B7280]" aria-label="Cerrar"><X size={16} /></button></div></form> : <div className="flex min-h-48 flex-col items-center justify-center text-center text-sm text-[#6B7280]"><Users size={28} className="mb-3 text-[#D1D5DB]" /><p>Seleccioná un usuario de la lista</p><p className="mt-1 text-xs">Después podrás asignarle un rol y contraseña.</p></div>}
        </section>
      </div>
    </div>
  );
}