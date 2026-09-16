import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus, Users, X } from 'lucide-react';
import { instructoresApi, type Instructor } from '../instructores.api';
import { Avatar, Button, Card, PageHeader, Pagination, StatCard } from '../../../shared/components/ui';

export function CrearInstructor() {
  const [form, setForm] = useState({ nombre: '', especialidad: '', telefono: '' });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [total, setTotal] = useState(0);
  const [activos, setActivos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalAbierto, setModalAbierto] = useState(false);

  function cargar() {
    instructoresApi.getAll(page).then((res) => { setInstructores(res.data); setTotalPages(res.totalPages); setTotal(res.total); }).catch(() => setInstructores([])).finally(() => setLoading(false));
  }
  useEffect(() => { cargar(); }, [page]);

  useEffect(() => {
    // TODO: conteo sobre una muestra amplia, no sobre el total — agregar agregación server-side en el futuro.
    instructoresApi.getAll(1, 100).then((res) => setActivos(res.data.filter((i) => i.activo).length)).catch(() => setActivos(0));
  }, []);

  const tituloLista = useMemo(() => `Instructores (${total})`, [total]);

  function abrirModal() {
    setForm({ nombre: '', especialidad: '', telefono: '' });
    setError(null);
    setModalAbierto(true);
  }

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
      setModalAbierto(false);
      cargar();
    } catch { setError('No se pudo crear el instructor. Revisá los datos.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Instructores"
        action={
          <Button size="sm" onClick={abrirModal}>
            <Plus size={16} /> Nuevo instructor
          </Button>
        }
      />
      <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
        Listado y alta de instructores. Tocá uno para ver detalle.
      </p>

      {mensaje && (
        <p className="mb-4 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm text-[#15803D]">
          {mensaje}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <StatCard label="Total instructores" value={String(total)} icon={Users} iconColor="#8B2EFF" />
        <StatCard label="Activos" value={String(activos)} icon={CheckCircle2} iconColor="#16A34A" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <h2 className="text-base font-bold text-[#111111] mb-3">{tituloLista}</h2>
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
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>

        <div>
          <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <Button fullWidth onClick={abrirModal}>
              <Plus size={16} /> Nuevo instructor
            </Button>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">Nuevo instructor</h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">Completá los datos para darlo de alta.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-[#6B7280] hover:text-[#111111]"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block"><span className="text-sm font-medium text-[#374151]">Nombre *</span><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} /></label>
              <label className="block"><span className="text-sm font-medium text-[#374151]">Especialidad</span><input value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} /></label>
              <label className="block"><span className="text-sm font-medium text-[#374151]">Teléfono</span><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} /></label>
              {error && <p className="text-sm text-[#DC2626]">{error}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" fullWidth onClick={() => setModalAbierto(false)}>Cancelar</Button>
                <Button type="submit" fullWidth disabled={submitting}>{submitting ? 'Creando…' : 'Crear instructor'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
