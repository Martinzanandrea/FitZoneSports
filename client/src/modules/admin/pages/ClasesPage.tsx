import { type FormEvent, useEffect, useState } from 'react';
import { BookOpen, Check, MapPin, Pencil, Plus, UserRound, X } from 'lucide-react';
import { clasesApi } from '../../clases/clases.api';
import type { Clase, ClasePayload } from '../../clases/clases.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { instructoresApi, type Instructor } from '../../instructores/instructores.api';

const EMPTY_FORM: ClasePayload = { sedeId: '', tipoClase: '', instructorId: '', horarioInicio: '', horarioFin: '', capacidad: 1 };

export function ClasesPage() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [form, setForm] = useState<ClasePayload>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([clasesApi.getAll(), sedesApi.getAll(), instructoresApi.getAll()])
      .then(([clasesCargadas, sedesCargadas, instructoresCargados]) => { setClases(clasesCargadas); setSedes(sedesCargadas); setInstructores(instructoresCargados); })
      .catch(() => setError('No se pudieron cargar las clases.'))
      .finally(() => setLoading(false));
  }, []);

  async function guardar(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, capacidad: Number(form.capacidad) };
      if (editingId) {
        const actualizada = await clasesApi.update(editingId, payload);
        setClases((actuales) => actuales.map((clase) => clase.id === editingId ? actualizada : clase));
      } else {
        const nueva = await clasesApi.create(payload);
        setClases((actuales) => [...actuales, nueva]);
      }
      cerrar();
    } catch { setError(editingId ? 'No se pudo actualizar la clase.' : 'No se pudo crear la clase.'); }
    finally { setSaving(false); }
  }

  function editar(clase: Clase) {
    setForm({ sedeId: clase.sede.id, tipoClase: clase.tipoClase, instructorId: clase.instructor.id, horarioInicio: toInputDate(clase.horarioInicio), horarioFin: toInputDate(clase.horarioFin), capacidad: clase.capacidad });
    setEditingId(clase.id); setShowForm(true); setError('');
  }
  function cerrar() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); }

  return <div className="max-w-5xl">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-[#111111]">Clases</h1><p className="mt-1 text-sm text-[#6B7280]">Administrá las clases grupales de todas las sedes.</p></div><button type="button" onClick={() => showForm ? cerrar() : setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#8B2EFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7620df]">{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Cerrar' : 'Agregar clase'}</button></div>
    {error && <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
    {showForm && <form onSubmit={guardar} className="mb-6 grid gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 md:grid-cols-2"><label className="text-sm font-medium text-[#374151]">Nombre de la clase<input required value={form.tipoClase} onChange={(e) => setForm({ ...form, tipoClase: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" /></label><label className="text-sm font-medium text-[#374151]">Sede<select required value={form.sedeId} onChange={(e) => setForm({ ...form, sedeId: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]"><option value="">Seleccionar sede...</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}</select></label><label className="text-sm font-medium text-[#374151]">Instructor<select required value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]"><option value="">Seleccionar instructor...</option>{instructores.filter((i) => i.activo).map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.nombre}</option>)}</select></label><label className="text-sm font-medium text-[#374151]">Cupo máximo<input required min={1} type="number" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: Number(e.target.value) })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" /></label><label className="text-sm font-medium text-[#374151]">Inicio<input required type="datetime-local" value={form.horarioInicio} onChange={(e) => setForm({ ...form, horarioInicio: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" /></label><label className="text-sm font-medium text-[#374151]">Fin<input required type="datetime-local" value={form.horarioFin} onChange={(e) => setForm({ ...form, horarioFin: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" /></label><div className="flex items-end md:col-span-2 md:justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} />{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar clase'}</button></div></form>}
    {loading ? <p className="text-sm text-[#6B7280]">Cargando clases...</p> : <div className="grid gap-3 md:grid-cols-2">{clases.map((clase) => <article key={clase.id} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white"><div className="flex aspect-[16/7] items-center justify-center bg-[#F3E8FF] text-sm text-[#8B2EFF]"><BookOpen size={20} className="mr-2" />Imagen de la clase</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#111111]">{clase.tipoClase}</h2><p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]"><MapPin size={13} />{clase.sede.nombre}</p></div><span className="rounded-full bg-[#F0FDF4] px-2.5 py-1 text-[11px] font-semibold text-[#15803D]">Programada</span></div><div className="mt-3 space-y-1 text-xs text-[#6B7280]"><p><UserRound size={13} className="mr-1 inline" />{clase.instructor.nombre}</p><p>Cupo máximo: <strong className="text-[#111111]">{clase.capacidad}</strong></p><p>{formatDate(clase.horarioInicio)} - {new Date(clase.horarioFin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p></div><div className="mt-5 border-t border-[#F3F4F6] pt-3"><button type="button" onClick={() => editar(clase)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#8B2EFF]"><Pencil size={14} />Editar</button></div></div></article>)}</div>}
  </div>;
}

function toInputDate(value: string) { const date = new Date(value); const pad = (n: number) => String(n).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatDate(value: string) { return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); }
