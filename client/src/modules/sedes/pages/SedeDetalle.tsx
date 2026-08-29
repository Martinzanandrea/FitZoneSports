import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sedesApi } from '../sedes.api';
import type { Sede } from '../sedes.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { canchasApi } from '../../canchas/canchas.api';
import { clasesApi } from '../../clases/clases.api';
import { PageHeader, Card, Button, StatCard } from '../../../shared/components/ui';
import { TipoActor } from '../../../shared/types/enums';

export function SedeDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sede, setSede] = useState<Sede | null>(null);
  const [form, setForm] = useState({ nombre: '', direccion: '', aforoMaximo: 0 });
  const [recepcionistas, setRecepcionistas] = useState<Usuario[]>([]);
  const [selectedRecep, setSelectedRecep] = useState('');
  const [counts, setCounts] = useState<{ canchas: number; clases: number; usuarios: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      sedesApi.getOne(id),
      usuariosApi.getStaff(),
      canchasApi.getAll().catch(() => [] as any),
      clasesApi.getAll().catch(() => [] as any),
      usuariosApi.getAll().catch(() => [] as Usuario[]),
    ]).then(([s, staff, canchas, clases, usuarios]) => {
      setSede(s);
      setForm({ nombre: s.nombre, direccion: s.direccion, aforoMaximo: s.aforoMaximo });
      const receps = (staff as Usuario[]).filter((u) => u.tipoActor === TipoActor.RECEPCIONISTA);
      setRecepcionistas(receps);
      const asignado = receps.find((r) => r.sede?.id === s.id);
      setSelectedRecep(asignado ? asignado.id : '');
      const canchasCount = (canchas as { sede: { id: string } }[]).filter((c) => c.sede.id === s.id).length;
      const clasesCount = (clases as { sede: { id: string } }[]).filter((c) => c.sede.id === s.id).length;
      const usuariosCount = (usuarios as Usuario[]).filter((u) => (u as any).sede?.id === s.id).length;
      setCounts({ canchas: canchasCount, clases: clasesCount, usuarios: usuariosCount });
    }).catch(() => setMsg({ type: 'err', text: 'No se pudo cargar la sede.' }))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id || !sede) return;
    setSaving(true); setMsg(null);
    try {
      const upd = await sedesApi.update(id, { nombre: form.nombre, direccion: form.direccion, aforoMaximo: Number(form.aforoMaximo) });
      setSede(upd);
      setMsg({ type: 'ok', text: 'Sede actualizada.' });
    } catch { setMsg({ type: 'err', text: 'No se pudo actualizar.' }); }
    finally { setSaving(false); }
  }

  async function handleAssign() {
    if (!selectedRecep) { setMsg({ type: 'err', text: 'Seleccioná un recepcionista.' }); return; }
    if (!id) return;
    setAssigning(true); setMsg(null);
    try {
      await usuariosApi.asignarSede(selectedRecep, id);
      setMsg({ type: 'ok', text: 'Recepcionista asignado.' });
      const staff = await usuariosApi.getStaff();
      const receps = staff.filter((u) => u.tipoActor === TipoActor.RECEPCIONISTA);
      setRecepcionistas(receps);
    } catch { setMsg({ type: 'err', text: 'No se pudo asignar.' }); }
    finally { setAssigning(false); }
  }

  if (loading) return <p className="text-sm text-[#6B7280]">Cargando sede...</p>;
  if (!sede) return <p className="text-sm text-[#B91C1C]">Sede no encontrada.</p>;

  return (
    <div className="max-w-5xl">
      <PageHeader title={sede.nombre} onBack={() => navigate('/admin/sedes')} />
      {msg && <p className={`mb-4 rounded-lg border p-3 text-sm ${msg.type==='ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Canchas" value={String(counts?.canchas ?? 0)} />
        <StatCard label="Clases" value={String(counts?.clases ?? 0)} />
        <StatCard label="Usuarios asignados" value={String(counts?.usuarios ?? 0)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-[#111111] mb-3">Datos de la sede</h3>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#374151]">Nombre
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
            </label>
            <label className="block text-sm font-medium text-[#374151]">Dirección
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
            </label>
            <label className="block text-sm font-medium text-[#374151]">Aforo máximo
              <input type="number" min={1} value={form.aforoMaximo} onChange={(e) => setForm({ ...form, aforoMaximo: Number(e.target.value) })} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
            </label>
            <Button onClick={handleSave} disabled={saving} fullWidth>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-[#111111] mb-3">Recepcionista asignado</h3>
          <div className="space-y-3">
            <select value={selectedRecep} onChange={(e) => setSelectedRecep(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF] bg-white" style={{ minHeight: 44 }}>
              <option value="">Seleccionar recepcionista...</option>
              {recepcionistas.map((r) => <option key={r.id} value={r.id}>{r.nombre} {r.apellido} — {r.email}{r.sede ? ` (${r.sede.nombre})` : ''}</option>)}
            </select>
            <Button variant="outline" onClick={handleAssign} disabled={assigning} fullWidth>{assigning ? 'Asignando...' : 'Asignar a esta sede'}</Button>
            <p className="text-xs text-[#6B7280]">Solo recepcionistas. Reasigna si ya tiene otra sede.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
