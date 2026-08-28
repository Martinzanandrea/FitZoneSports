import { type FormEvent, useEffect, useState } from 'react';
import { Check, MapPin, Pencil, Plus, X } from 'lucide-react';
import { canchasApi } from '../../canchas/canchas.api';
import { EstadoCancha, TipoCancha, type Cancha, type CanchaPayload } from '../../canchas/canchas.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';

type CanchaForm = CanchaPayload & { estado: Cancha['estado'] };
const EMPTY_FORM: CanchaForm = { sedeId: '', nombre: '', tipo: TipoCancha.PADDLE, costoHoraBase: 0, estado: EstadoCancha.ACTIVA };

export function CanchasPage() {
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [form, setForm] = useState<CanchaForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([canchasApi.getAll(), sedesApi.getAll()])
      .then(([canchasCargadas, sedesCargadas]) => { setCanchas(canchasCargadas); setSedes(sedesCargadas); })
      .catch(() => setError('No se pudieron cargar las canchas.'))
      .finally(() => setLoading(false));
  }, []);

  async function guardar(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, costoHoraBase: Number(form.costoHoraBase) };
      if (editingId) {
        const actualizada = await canchasApi.update(editingId, payload);
        setCanchas((actuales) => actuales.map((cancha) => cancha.id === editingId ? actualizada : cancha));
      } else {
        const nueva = await canchasApi.create(payload);
        setCanchas((actuales) => [...actuales, nueva]);
      }
      cerrar();
    } catch {
      setError(editingId ? 'No se pudo actualizar la cancha.' : 'No se pudo crear la cancha.');
    }
    finally { setSaving(false); }
  }

  function editar(cancha: Cancha) {
    setForm({ sedeId: cancha.sede.id, nombre: cancha.nombre, tipo: cancha.tipo, costoHoraBase: Number(cancha.costoHoraBase), estado: cancha.estado });
    setEditingId(cancha.id); setShowForm(true); setError('');
  }
  function cerrar() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); }

  return <div className="max-w-5xl">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-[#111111]">Canchas</h1><p className="mt-1 text-sm text-[#6B7280]">Administrá las canchas de todas las sedes.</p></div><button type="button" onClick={() => showForm ? cerrar() : setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#8B2EFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7620df]">{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Cerrar' : 'Agregar cancha'}</button></div>
    {error && <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
    {showForm && <form onSubmit={guardar} className="mb-6 grid gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 md:grid-cols-2"><label className="text-sm font-medium text-[#374151]">Nombre<input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" /></label><label className="text-sm font-medium text-[#374151]">Sede<select required value={form.sedeId} onChange={(e) => setForm({ ...form, sedeId: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]"><option value="">Seleccionar sede...</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}</select></label><label className="text-sm font-medium text-[#374151]">Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as CanchaPayload['tipo'] })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]"><option value={TipoCancha.PADDLE}>Paddle</option><option value={TipoCancha.FUTBOL5}>Fútbol 5</option></select></label><label className="text-sm font-medium text-[#374151]">Precio por hora<input required min={0.01} type="number" step="0.01" value={form.costoHoraBase} onChange={(e) => setForm({ ...form, costoHoraBase: Number(e.target.value) })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" /></label><label className="text-sm font-medium text-[#374151]">Estado<select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Cancha['estado'] })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]"><option value={EstadoCancha.ACTIVA}>Activa</option><option value={EstadoCancha.MANTENIMIENTO}>Mantenimiento</option></select></label><div className="flex items-end md:col-span-2 md:justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} />{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar cancha'}</button></div></form>}
    {loading ? <p className="text-sm text-[#6B7280]">Cargando canchas...</p> : <div className="grid gap-3 md:grid-cols-2">{canchas.map((cancha) => <article key={cancha.id} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white"><div className="flex aspect-[16/7] items-center justify-center bg-[#F3E8FF] text-sm text-[#8B2EFF]">Imagen de la cancha</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#111111]">{cancha.nombre}</h2><p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]"><MapPin size={13} />{cancha.sede.nombre}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cancha.estado === EstadoCancha.ACTIVA ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>{cancha.estado === EstadoCancha.ACTIVA ? 'Activa' : 'Mantenimiento'}</span></div><div className="mt-5 flex items-center justify-between border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280"><span>{cancha.tipo} · <strong className="text-[#111111]">${cancha.costoHoraBase}/h</strong></span><button type="button" onClick={() => editar(cancha)} className="inline-flex items-center gap-1.5 font-semibold hover:text-[#8B2EFF]"><Pencil size={14} />Editar</button></div></div></article>)}</div>}
  </div>;
}
