import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, Check, ClipboardList, DollarSign, MapPin, Pencil, Plus, X } from 'lucide-react';
import { canchasApi, tiposCanchaApi } from '../../canchas/canchas.api';
import { EstadoCancha, type Cancha, type CanchaPayload, type TipoCanchaCatalogo } from '../../canchas/canchas.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { Button, Chip, PageHeader, Pagination, StatCard, formatMoney } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { useTitulo } from '../../../shared/hooks/useTitulo';

type CanchaForm = CanchaPayload & { estado: Cancha['estado'] };
const EMPTY_FORM: CanchaForm = { sedeId: '', nombre: '', tipoId: '', costoHoraBase: 0, estado: EstadoCancha.ACTIVA };

export function CanchasPage() {
  useTitulo('Canchas');
  const navigate = useNavigate();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [tipos, setTipos] = useState<TipoCanchaCatalogo[]>([]);
  const [form, setForm] = useState<CanchaForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filtroSede, setFiltroSede] = useState('TODAS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [ingresosMes, setIngresosMes] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([canchasApi.getAll(page), sedesApi.getAll(1, 100), tiposCanchaApi.listarTodos().catch(() => [] as TipoCanchaCatalogo[])])
      .then(([canchasRes, sedesRes, tiposRes]) => { setCanchas(canchasRes.data); setTotalPages(canchasRes.totalPages); setTotal(canchasRes.total); setSedes(sedesRes.data); setTipos(tiposRes); })
      .catch(() => setError('No se pudieron cargar las canchas.'))
      .finally(() => setLoading(false));
    canchasApi.getIngresosMes().then((res) => setIngresosMes(res.total)).catch(() => setIngresosMes(null));
  }, [page]);

  // TODO: estos filtros y conteos solo aplican a la página actual, no al total —
  // filtrar/contar server-side en el futuro.
  const filtradas = useMemo(() => canchas.filter((c) => {
    const okSede = filtroSede === 'TODAS' || c.sede.id === filtroSede;
    const okTipo = filtroTipo === 'TODOS' || c.tipoId === filtroTipo;
    return okSede && okTipo;
  }), [canchas, filtroSede, filtroTipo]);

  // "Total canchas" viene del total del backend; "En mantenimiento" se cuenta
  // sobre la página visible (ver TODO de arriba).
  const enMantenimiento = canchas.filter((c) => c.estado === EstadoCancha.MANTENIMIENTO).length;

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
    setForm({ sedeId: cancha.sede.id, nombre: cancha.nombre, tipoId: cancha.tipoId, costoHoraBase: Number(cancha.costoHoraBase), estado: cancha.estado });
    setEditingId(cancha.id); setShowForm(true); setError('');
  }
  function cerrar() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); }

  return <div className="max-w-6xl">
    <PageHeader
      title="Canchas"
      action={
        <Button size="sm" onClick={() => (showForm ? cerrar() : setShowForm(true))}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cerrar' : 'Nueva cancha'}
        </Button>
      }
    />
    <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
      Administrá las canchas de todas las sedes.
    </p>
    {error && <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <StatCard label="Total canchas" value={String(total)} icon={Building2} iconColor="#8B2EFF" />
      <StatCard label="En mantenimiento" value={String(enMantenimiento)} icon={AlertTriangle} iconColor="#D97706" />
      <StatCard label="Ingresos canchas (mes)" value={ingresosMes === null ? (loading ? '...' : '—') : formatMoney(ingresosMes)} icon={DollarSign} iconColor="#16A34A" />
    </div>

    <div className="mb-4 flex flex-wrap gap-2">
      <Chip label="Todas las sedes" active={filtroSede === 'TODAS'} onClick={() => setFiltroSede('TODAS')} />
      {sedes.map((s) => <Chip key={s.id} label={s.nombre} active={filtroSede === s.id} onClick={() => setFiltroSede(s.id)} />)}
    </div>
    <div className="mb-6 flex gap-2">
      <Chip label="Todos los tipos" active={filtroTipo === 'TODOS'} onClick={() => setFiltroTipo('TODOS')} />
      {tipos.map((t) => <Chip key={t.id} label={t.activo ? t.nombre : `${t.nombre} (inactivo)`} active={filtroTipo === t.id} onClick={() => setFiltroTipo(t.id)} />)}
    </div>

    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div>
    {showForm && <form onSubmit={guardar} className="mb-6 grid gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 md:grid-cols-2"><label className="text-sm font-medium text-[#374151]">Nombre<input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label><label className="text-sm font-medium text-[#374151]">Sede<div className="mt-1.5"><Select required value={form.sedeId} onChange={(v) => setForm({ ...form, sedeId: v })} placeholder="Seleccionar sede..." opciones={sedes.map((sede) => ({ value: sede.id, label: sede.nombre }))} /></div></label><label className="text-sm font-medium text-[#374151]">Tipo<div className="mt-1.5"><Select required value={form.tipoId} onChange={(v) => setForm({ ...form, tipoId: v })} placeholder="Seleccionar tipo..." opciones={tipos.map((t) => ({ value: t.id, label: t.activo ? t.nombre : `${t.nombre} (inactivo)`, disabled: !t.activo }))} /></div></label><label className="text-sm font-medium text-[#374151]">Precio por hora<input required min={0.01} type="number" step="0.01" value={form.costoHoraBase} onChange={(e) => setForm({ ...form, costoHoraBase: Number(e.target.value) })} className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} /></label><label className="text-sm font-medium text-[#374151]">Estado<div className="mt-1.5"><Select value={form.estado} onChange={(v) => setForm({ ...form, estado: v as Cancha['estado'] })} opciones={[{ value: EstadoCancha.ACTIVA, label: 'Activa' }, { value: EstadoCancha.MANTENIMIENTO, label: 'Mantenimiento' }]} /></div></label><div className="flex items-end md:justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ minHeight: 44 }}><Check size={16} />{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}</button></div></form>}
    {loading ? <p className="text-sm text-[#6B7280]">Cargando canchas...</p> : filtradas.length === 0 ? <p className="text-sm text-[#6B7280]">Sin canchas para ese filtro.</p> : <div className="grid gap-3 md:grid-cols-2">{filtradas.map((cancha) => <article key={cancha.id} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white"><div className="flex aspect-[16/7] items-center justify-center bg-[#F3E8FF] overflow-hidden"><img src={cancha.tipo.imagenUrl ?? '/images/landing/gimnasio-alt.jpg'} alt={`Cancha de ${cancha.tipo.nombre}`} className="w-full h-full object-cover" loading="lazy" /></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#111111]">{cancha.nombre}</h2><p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]"><MapPin size={13} />{cancha.sede.nombre}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cancha.estado === EstadoCancha.ACTIVA ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>{cancha.estado === EstadoCancha.ACTIVA ? 'Activa' : 'Mantenimiento'}</span></div><div className="mt-5 flex items-center justify-between border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280]"><span>{cancha.tipo.nombre} · <strong className="text-[#111111]">${cancha.costoHoraBase}/h</strong></span><button type="button" onClick={() => editar(cancha)} className="inline-flex items-center gap-1.5 font-semibold hover:text-[#8B2EFF]" style={{ minHeight: 44 }}><Pencil size={14} />Editar</button></div></div></article>)}</div>}
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Button variant="outline" fullWidth onClick={() => navigate('/admin/canchas/tipos')}>
            <Pencil size={16} /> Gestionar tipos
          </Button>
          <Button variant="outline" fullWidth onClick={() => navigate('/admin/reservas')}>
            <ClipboardList size={16} /> Ver reservas de hoy
          </Button>
        </div>
      </div>
    </div>
  </div>;
}
