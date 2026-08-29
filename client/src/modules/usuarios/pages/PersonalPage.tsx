import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, UserPlus, X } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Usuario } from '../usuarios.types';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { Avatar, StatCard } from '../../../shared/components/ui';

export function PersonalPage() {
  const [staff, setStaff] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [formulario, setFormulario] = useState({ nombre: '', apellido: '', email: '', telefono: '', dni: '' });
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  useEffect(() => {
    cargar();
    sedesApi.getAll().then(setSedes).catch(() => setSedes([]));
  }, []);

  function cargar() {
    usuariosApi.getStaff().then(setStaff).catch(() => setStaff([]));
  }

  const recepcionistas = useMemo(() => staff.filter((u) => u.tipoActor === TipoActor.RECEPCIONISTA), [staff]);
  const sedesSinRecepcionista = useMemo(() => {
    const sedeIdsConRecep = new Set(recepcionistas.filter((r) => r.sede?.id).map((r) => r.sede!.id));
    return sedes.filter((s) => !sedeIdsConRecep.has(s.id));
  }, [sedes, recepcionistas]);

  async function handleCambiarSede(usuarioId: string, sedeId: string) {
    if (!sedeId) return;
    setCambiando(usuarioId);
    try {
      await usuariosApi.asignarSede(usuarioId, sedeId);
      cargar();
    } catch {
      alert('No se pudo reasignar la sede.');
    } finally {
      setCambiando(null);
    }
  }

  function abrirEdicion(usuario: Usuario) {
    setEditando(usuario);
    setErrorEdicion('');
    setFormulario({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono ?? '',
      dni: usuario.dni ?? '',
    });
  }

  async function guardarEdicion(event: React.FormEvent) {
    event.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setErrorEdicion('');
    try {
      await usuariosApi.actualizar(editando.id, {
        ...formulario,
        telefono: formulario.telefono || undefined,
        dni: formulario.dni || undefined,
      });
      setEditando(null);
      cargar();
    } catch {
      setErrorEdicion('No se pudieron guardar los cambios. Revisá los datos.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Personal</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Recepcionistas y gerentes de la cadena</p>
        </div>
        <Link to="/admin/personal/nuevo" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold hover:bg-[#7A25E6] transition-colors" style={{ minHeight: 44 }}>
          <UserPlus size={16} /> Nuevo
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Total personal" value={String(staff.length)} />
        <StatCard label="Recepcionistas" value={String(recepcionistas.length)} />
        <div className={`rounded-xl p-4 border ${sedesSinRecepcionista.length > 0 ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-white border-[#E5E7EB]'}`}>
          <p className="text-[13px] font-medium text-[#6B7280]">Sedes sin recepcionista</p>
          <p className={`text-[28px] font-bold tracking-tight mt-2 ${sedesSinRecepcionista.length > 0 ? 'text-[#92400E]' : 'text-[#111111]'}`}>{sedesSinRecepcionista.length}</p>
          {sedesSinRecepcionista.length > 0 && <p className="text-xs text-[#92400E] mt-1">{sedesSinRecepcionista.map((s) => s.nombre).join(', ')}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Sede</th>
              <th className="px-5 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id} className="border-b border-[#E5E7EB] last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={`${u.nombre} ${u.apellido}`} size={36} />
                    <div>
                      <p className="font-medium text-[#111111]">{u.nombre} {u.apellido}</p>
                      <p className="text-xs text-[#6B7280]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${u.tipoActor === TipoActor.GERENTE ? 'bg-[#F3E8FF] text-[#8B2EFF]' : 'bg-[#F3F4F6] text-[#374151]'}`}>{u.tipoActor}</span>
                </td>
                <td className="px-5 py-3.5">
                  {u.tipoActor === TipoActor.GERENTE ? <span className="text-xs text-[#6B7280]">Todas las sedes</span> : (
                    <select value={u.sede?.id ?? ''} disabled={cambiando === u.id} onChange={(e) => handleCambiarSede(u.id, e.target.value)} className="px-2.5 py-1.5 rounded-md border border-[#E5E7EB] text-xs focus:border-[#8B2EFF] focus:ring-1 focus:ring-[#8B2EFF]/30 outline-none" style={{ minHeight: 44 }}>
                      <option value="">Sin asignar</option>
                      {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <button type="button" onClick={() => abrirEdicion(u)} className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#8B2EFF] hover:text-[#8B2EFF]" style={{ minHeight: 44 }}>
                    <Pencil size={14} /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && <p className="p-8 text-center text-sm text-[#6B7280]">Todavía no hay personal cargado.</p>}
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">Editar personal</h2>
                <p className="mt-1 text-xs text-[#6B7280]">Actualizá los datos de la cuenta.</p>
              </div>
              <button type="button" onClick={() => setEditando(null)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Cerrar edición"><X size={18} /></button>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5"><span className="text-sm font-medium text-[#374151]">Nombre</span><input required value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label>
                <label className="space-y-1.5"><span className="text-sm font-medium text-[#374151]">Apellido</span><input required value={formulario.apellido} onChange={(e) => setFormulario({ ...formulario, apellido: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label>
              </div>
              <label className="block space-y-1.5"><span className="text-sm font-medium text-[#374151]">Email</span><input type="email" required value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5"><span className="text-sm font-medium text-[#374151]">DNI</span><input value={formulario.dni} onChange={(e) => setFormulario({ ...formulario, dni: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label>
                <label className="space-y-1.5"><span className="text-sm font-medium text-[#374151]">Teléfono</span><input value={formulario.telefono} onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label>
              </div>
              {errorEdicion && <p className="text-sm text-[#DC2626]">{errorEdicion}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditando(null)} className="rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#374151]" style={{ minHeight: 44 }}>Cancelar</button>
                <button type="submit" disabled={guardando} className="rounded-lg bg-[#8B2EFF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ minHeight: 44 }}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
