import { type FormEvent, useEffect, useState } from 'react';
import { Building2, Check, Pencil, Plus, Power, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sedesApi } from '../sedes.api';
import type { CreateSedePayload, Sede } from '../sedes.types';

const EMPTY_FORM: CreateSedePayload = {
  nombre: '',
  direccion: '',
  aforoMaximo: 100,
};

export function SedesPage() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [form, setForm] = useState<CreateSedePayload>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingSedeId, setEditingSedeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSedes() {
      try {
        const sedesCargadas = await sedesApi.getAll();
        if (!cancelled) {
          setSedes(sedesCargadas);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('No se pudieron cargar las sedes.');
          setLoading(false);
        }
      }
    }

    void loadSedes();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        aforoMaximo: Number(form.aforoMaximo),
      };

      if (editingSedeId) {
        const sedeActualizada = await sedesApi.update(editingSedeId, payload);
        setSedes((current) => current.map((sede) => sede.id === editingSedeId ? sedeActualizada : sede));
      } else {
        const nuevaSede = await sedesApi.create(payload);
        setSedes((current) => [...current, nuevaSede]);
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingSedeId(null);
    } catch {
      setError(editingSedeId ? 'No se pudo actualizar la sede. Revisá los datos.' : 'No se pudo crear la sede. Revisá los datos.');
    } finally {
      setSaving(false);
    }
  }

  function editSede(sede: Sede) {
    setForm({
      nombre: sede.nombre,
      direccion: sede.direccion,
      aforoMaximo: sede.aforoMaximo,
    });
    setEditingSedeId(sede.id);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setEditingSedeId(null);
    setShowForm(false);
    setError(null);
  }

  async function toggleSede(sede: Sede) {
    try {
      const actualizada = await sedesApi.update(sede.id, { activa: !sede.activa });
      setSedes((current) => current.map((item) => item.id === sede.id ? actualizada : item));
    } catch {
      setError('No se pudo actualizar el estado de la sede.');
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Sedes</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Administrá las sucursales de FitZone.</p>
        </div>
        <button
          type="button"
          onClick={() => showForm ? closeForm() : setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#8B2EFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7620df] focus:outline-none focus:ring-2 focus:ring-[#8B2EFF]/30"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cerrar' : 'Nueva sede'}
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 md:grid-cols-2">
          <label className="text-sm font-medium text-[#374151]">
            Nombre
            <input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" />
          </label>
          <label className="text-sm font-medium text-[#374151]">
            Dirección
            <input required value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" />
          </label>
          <label className="text-sm font-medium text-[#374151]">
            Aforo máximo
            <input required min={1} type="number" value={form.aforoMaximo} onChange={(event) => setForm({ ...form, aforoMaximo: Number(event.target.value) })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" />
          </label>
          <div className="flex items-end md:justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              <Check size={16} />
              {saving ? 'Guardando...' : editingSedeId ? 'Guardar cambios' : 'Guardar sede'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando sedes...</p>
      ) : sedes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10 text-center">
          <Building2 className="mx-auto text-[#8B2EFF]" size={28} />
          <p className="mt-3 text-sm font-semibold text-[#111111]">Todavía no hay sedes</p>
          <p className="mt-1 text-sm text-[#6B7280]">Creá la primera sucursal para comenzar.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sedes.map((sede) => (
            <Link key={sede.id} to={`/admin/sedes/${sede.id}`} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 block hover:border-[#8B2EFF] hover:shadow-md transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#8B2EFF]"><Building2 size={18} /></div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#111111]">{sede.nombre}</h2>
                    <p className="mt-1 text-xs text-[#6B7280]">{sede.direccion}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sede.activa ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                  {sede.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280]">
                <span>Aforo máximo: <strong className="text-[#111111]">{sede.aforoMaximo}</strong></span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={(e) => { e.preventDefault(); editSede(sede); }} className="inline-flex items-center gap-1.5 font-semibold text-[#6B7280] hover:text-[#8B2EFF]">
                    <Pencil size={14} /> Editar
                  </button>
                  <button type="button" onClick={(e) => { e.preventDefault(); void toggleSede(sede); }} className="inline-flex items-center gap-1.5 font-semibold text-[#6B7280] hover:text-[#8B2EFF]">
                    <Power size={14} /> {sede.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
