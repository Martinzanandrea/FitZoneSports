import { type FormEvent, useState } from 'react';
import { instructoresApi } from '../instructores.api';

export function CrearInstructor() {
  const [form, setForm] = useState({ nombre: '', especialidad: '', telefono: '' });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setSubmitting(true);
    try {
      const payload: { nombre: string; especialidad?: string; telefono?: string } = { nombre: form.nombre.trim() };
      if (form.especialidad.trim()) payload.especialidad = form.especialidad.trim();
      if (form.telefono.trim()) payload.telefono = form.telefono.trim();
      const instructor = await instructoresApi.create(payload);
      setMensaje(`${instructor.nombre} creado correctamente`);
      setForm({ nombre: '', especialidad: '', telefono: '' });
    } catch {
      setError('No se pudo crear el instructor. Revisá los datos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#111111] mb-6">Crear instructor</h1>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Nombre *</span>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Especialidad</span>
          <input
            value={form.especialidad}
            onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Teléfono</span>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>
        {mensaje && <p className="text-sm text-[#16A34A]">{mensaje}</p>}
        {error && <p className="text-sm text-[#DC2626]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold hover:bg-[#7A25E6] disabled:opacity-60 transition-colors"
          style={{ minHeight: 44 }}
        >
          {submitting ? 'Creando…' : 'Crear instructor'}
        </button>
      </form>
    </div>
  );
}
