import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { instructoresApi, type Instructor } from '../instructores.api';
import { clasesApi } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { PageHeader, Card, Button, Avatar } from '../../../shared/components/ui';

export function InstructorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inst, setInst] = useState<Instructor | null>(null);
  const [clases, setClases] = useState<Clase[]>([]);
  const [form, setForm] = useState({ nombre: '', especialidad: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([instructoresApi.getOne(id), clasesApi.getAll().catch(() => [] as Clase[])])
      .then(([instructor, todasClases]) => {
        setInst(instructor);
        setForm({ nombre: instructor.nombre, especialidad: instructor.especialidad ?? '' });
        setClases(todasClases.filter((c) => c.instructor.id === id));
      })
      .catch(() => setMsg({ type: 'err', text: 'No se pudo cargar.' }))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true); setMsg(null);
    try {
      const upd = await instructoresApi.update(id, { nombre: form.nombre, especialidad: form.especialidad || null });
      setInst(upd);
      setMsg({ type: 'ok', text: 'Guardado.' });
    } catch { setMsg({ type: 'err', text: 'No se pudo guardar.' }); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-[#6B7280]">Cargando...</p>;
  if (!inst) return <p className="text-sm text-[#B91C1C]">Instructor no encontrado.</p>;

  return (
    <div className="max-w-3xl">
      <PageHeader title={inst.nombre} onBack={() => navigate('/admin/instructores')} />
      {msg && <p className={`mb-4 rounded-lg border p-3 text-sm ${msg.type==='ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={inst.nombre} size={48} />
          <div>
            <p className="text-sm font-bold text-[#111111]">{inst.nombre}</p>
            <p className="text-xs text-[#6B7280]">{inst.especialidad ?? 'Sin especialidad'} · {inst.activo ? 'Activo' : 'Inactivo'}</p>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#374151]">Nombre
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
          </label>
          <label className="block text-sm font-medium text-[#374151]">Especialidad
            <input value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
          </label>
          <Button onClick={handleSave} disabled={saving} fullWidth>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
        </div>
      </Card>

      <h3 className="text-base font-bold text-[#111111] mb-3">Clases asociadas ({clases.length})</h3>
      {clases.length === 0 ? <Card className="py-6 text-center text-sm text-[#6B7280]">Sin clases asignadas.</Card> : (
        <div className="space-y-2">
          {clases.map((c) => (
            <Link key={c.id} to="/admin/clases" className="block rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#8B2EFF] transition-colors">
              <p className="text-sm font-semibold text-[#111111]">{c.tipoClase} · {c.sede.nombre}</p>
              <p className="text-xs text-[#6B7280] mt-1">{new Date(c.horarioInicio).toLocaleString('es-AR')} · Cupo {c.capacidad}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
