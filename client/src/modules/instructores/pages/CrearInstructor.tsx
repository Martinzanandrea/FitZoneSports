import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { instructoresApi, type Instructor } from '../instructores.api';
import { Card, Avatar } from '../../../shared/components/ui';

export function CrearInstructor() {
  const [form, setForm] = useState({ nombre: '', especialidad: '', telefono: '' });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  function cargar() {
    instructoresApi.getAll().then(setInstructores).catch(() => setInstructores([])).finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null); setError(null); setSubmitting(true);
    try {
      const payload: { nombre: string; especialidad?: string; telefono?: string } = { nombre: form.nombre.trim() };
      if (form.especialidad.trim()) payload.especialidad = form.especialidad.trim();
      if (form.telefono.trim()) payload.telefono = form.telefono.trim();
      const instructor = await instructoresApi.create(payload);
      setMensaje(`${instructor.nombre} creado correctamente`);
      setForm({ nombre: '', especialidad: '', telefono: '' });
      cargar();
    } catch { setError('No se pudo crear el instructor. Revisá los datos.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-[#111111]">Instructores</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Listado y alta de instructores. Tocá uno para ver detalle.</p>

      <div className="mt-6">
        <h2 className="text-base font-bold text-[#111111] mb-3">Instructores ({instructores.length})</h2>
        {loading ? <p className="text-sm text-[#6B7280]">Cargando...</p> : instructores.length === 0 ? <Card className="py-6 text-center text-sm text-[#6B7280]">Sin instructores.</Card> : (
          <div className="space-y-2 mb-8">
            {instructores.map((ins) => (
              <Link key={ins.id} to={`/admin/instructores/${ins.id}`} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#8B2EFF] transition-colors">
                <Avatar name={ins.nombre} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111111] truncate">{ins.nombre}</p>
                  <p className="text-xs text-[#6B7280] truncate">{ins.especialidad ?? 'Sin especialidad'} · {ins.activo ? 'Activo' : 'Inactivo'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-base font-bold text-[#111111] mb-3">Crear instructor</h2>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5">
        <label className="block"><span className="text-sm font-medium text-[#374151]">Nombre *</span><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} /></label>
        <label className="block"><span className="text-sm font-medium text-[#374151]">Especialidad</span><input value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} /></label>
        <label className="block"><span className="text-sm font-medium text-[#374151]">Teléfono</span><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} /></label>
        {mensaje && <p className="text-sm text-[#16A34A]">{mensaje}</p>}
        {error && <p className="text-sm text-[#DC2626]">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold hover:bg-[#7A25E6] disabled:opacity-60 transition-colors" style={{ minHeight: 44 }}>{submitting ? 'Creando…' : 'Crear instructor'}</button>
      </form>
    </div>
  );
}
