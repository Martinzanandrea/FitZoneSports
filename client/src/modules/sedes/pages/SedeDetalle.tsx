import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Building2, Clock3, Plus, Tag, Trash2, Users } from 'lucide-react';
import { sedesApi } from '../sedes.api';
import type { FranjaHoraria, Sede } from '../sedes.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { canchasApi } from '../../canchas/canchas.api';
import { clasesApi } from '../../clases/clases.api';
import { Badge } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { MetricCard } from '../../../shared/components/MetricCard';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function SedeDetalle() {
  useTitulo('Detalle de sede');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sede, setSede] = useState<Sede | null>(null);
  const [form, setForm] = useState({ nombre: '', direccion: '', aforoMaximo: 0 });
  const [recepcionistas, setRecepcionistas] = useState<Usuario[]>([]);
  const [selectedRecep, setSelectedRecep] = useState('');
  const [counts, setCounts] = useState<{ canchas: number; clases: number; usuarios: number } | null>(null);
  const [franjas, setFranjas] = useState<FranjaHoraria[]>([]);
  const [apertura, setApertura] = useState('');
  const [cierre, setCierre] = useState('');
  const [guardandoFranja, setGuardandoFranja] = useState(false);
  const [eliminandoFranja, setEliminandoFranja] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    Promise.all([
      sedesApi.getOne(id),
      usuariosApi.getStaff(1, 100),
      canchasApi.getAll(1, 100).catch(() => ({ data: [] as unknown[] })),
      clasesApi.getAll(id, 1, 100).catch(() => ({ data: [] as unknown[] })),
      // Los conteos se calculan sobre la primera página (hasta 100), no sobre el total.
      usuariosApi.getAll(1, 100).catch(() => ({ data: [] as Usuario[] })),
      sedesApi.getFranjas(id).catch(() => [] as FranjaHoraria[]),
    ])
      .then(([s, staff, canchas, clases, usuarios, franjasData]) => {
        if (!viva) return;
        setSede(s);
        setForm({ nombre: s.nombre, direccion: s.direccion, aforoMaximo: s.aforoMaximo });
        // Solo activos: un recepcionista dado de baja no atiende la sede.
        setRecepcionistas(staff.data.filter((u) => u.tipoActor === TipoActor.RECEPCIONISTA && u.activo));
        setSelectedRecep('');
        setCounts({
          canchas: (canchas.data as { sede: { id: string } }[]).filter((c) => c.sede.id === s.id).length,
          clases: clases.data.length,
          usuarios: (usuarios.data as Usuario[]).filter((u) => u.sede?.id === s.id).length,
        });
        setFranjas(franjasData);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setLoading(false));
    return () => {
      viva = false;
    };
  }, [id, recarga]);

  const asignados = recepcionistas.filter((r) => r.sede?.id === id);

  async function handleSave() {
    if (!id || !sede) return;
    setSaving(true);
    setMsg(null);
    try {
      const upd = await sedesApi.update(id, { nombre: form.nombre, direccion: form.direccion, aforoMaximo: Number(form.aforoMaximo) });
      setSede(upd);
      setMsg({ type: 'ok', text: 'Sede actualizada.' });
    } catch {
      setMsg({ type: 'err', text: 'No se pudo actualizar.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!selectedRecep) {
      setMsg({ type: 'err', text: 'Seleccioná un recepcionista.' });
      return;
    }
    if (!id) return;
    setAssigning(true);
    setMsg(null);
    try {
      await usuariosApi.asignarSede(selectedRecep, id);
      setMsg({ type: 'ok', text: 'Recepcionista asignado.' });
      setRecarga((n) => n + 1); // vuelve a pedir sede, personal y conteos
    } catch (e) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setMsg({ type: 'err', text: Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo asignar.' });
    } finally {
      setAssigning(false);
    }
  }

  async function handleAgregarFranja() {
    if (!id) return;
    if (!apertura || !cierre) {
      setMsg({ type: 'err', text: 'Completá apertura y cierre.' });
      return;
    }
    if (cierre <= apertura) {
      setMsg({ type: 'err', text: 'El cierre debe ser mayor que la apertura.' });
      return;
    }
    setGuardandoFranja(true);
    setMsg(null);
    try {
      const nueva = await sedesApi.crearFranja(id, { apertura, cierre });
      setFranjas((prev) => [...prev, nueva].sort((a, b) => a.apertura.localeCompare(b.apertura)));
      setApertura('');
      setCierre('');
      setMsg({ type: 'ok', text: 'Franja agregada.' });
    } catch {
      setMsg({ type: 'err', text: 'No se pudo agregar la franja.' });
    } finally {
      setGuardandoFranja(false);
    }
  }

  async function handleEliminarFranja(franjaId: string) {
    if (!id) return;
    setEliminandoFranja(franjaId);
    setMsg(null);
    try {
      await sedesApi.eliminarFranja(id, franjaId);
      setFranjas((prev) => prev.filter((f) => f.id !== franjaId));
      setMsg({ type: 'ok', text: 'Franja eliminada.' });
    } catch {
      setMsg({ type: 'err', text: 'No se pudo eliminar la franja.' });
    } finally {
      setEliminandoFranja(null);
    }
  }

  if (loading) return <LoadingState rows={3} label="Cargando sede" />;
  if (error || !sede) {
    return <ErrorState title="No pudimos cargar la sede" description="Puede que no exista o que no tengas acceso." onRetry={() => setRecarga((n) => n + 1)} />;
  }

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>{sede.nombre}</h2>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {sede.direccion} <Badge variant={sede.activa ? 'success' : 'neutral'}>{sede.activa ? 'Activa' : 'Inactiva'}</Badge>
          </p>
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/admin/sedes')}>
            <ArrowLeft size={15} aria-hidden /> Volver
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/precios')}>
            <Tag size={15} aria-hidden /> Configurar precios
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/admin/sedes', { state: { nueva: true } })}>
            <Plus size={16} aria-hidden /> Nueva sede
          </button>
        </div>
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Canchas" value={String(counts?.canchas ?? 0)} change="en la sede" icon={Building2} />
        <MetricCard label="Clases" value={String(counts?.clases ?? 0)} change="programadas" icon={BookOpen} />
        <MetricCard label="Usuarios asignados" value={String(counts?.usuarios ?? 0)} change="con esta sede" icon={Users} />
        <MetricCard label="Franjas de atención" value={String(franjas.length)} change="horarios cargados" icon={Clock3} />
      </div>

      <div className="stack-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <section className="glass panel">
          <SectionHeader title="Datos de la sede" />
          <div className="stack-gap">
            <label>
              <span className="field-label">NOMBRE</span>
              <input className="field-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label>
              <span className="field-label">DIRECCIÓN</span>
              <input className="field-input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </label>
            <label>
              <span className="field-label">AFORO MÁXIMO</span>
              <input className="field-input" type="number" min={1} value={form.aforoMaximo} onChange={(e) => setForm({ ...form, aforoMaximo: Number(e.target.value) })} />
            </label>
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </section>

        <section className="glass panel">
          <SectionHeader title="Recepcionistas de la sede" description="Asigna a esta sede (reasigna si ya tiene otra)." />
          <div className="stack-gap">
            {asignados.length === 0 ? (
              <p style={{ fontSize: 12 }}>Esta sede no tiene recepcionistas asignados.</p>
            ) : (
              <ul className="stack-gap" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                {asignados.map((r) => (
                  <li key={r.id} className="ops-strong" style={{ fontSize: 13 }}>
                    {r.nombre} {r.apellido} <span style={{ fontWeight: 400 }}>— {r.email}</span>
                  </li>
                ))}
              </ul>
            )}
            <Select
              value={selectedRecep}
              onChange={setSelectedRecep}
              placeholder="Seleccionar recepcionista..."
              ariaLabel="Recepcionista"
              opciones={recepcionistas.filter((r) => r.sede?.id !== id).map((r) => ({ value: r.id, label: `${r.nombre} ${r.apellido} — ${r.email}${r.sede ? ` (${r.sede.nombre})` : ''}` }))}
            />
            <button className="btn btn-secondary" onClick={() => void handleAssign()} disabled={assigning}>
              {assigning ? 'Asignando...' : 'Asignar a esta sede'}
            </button>
          </div>
        </section>
      </div>

      <section className="glass panel" style={{ marginTop: 14 }}>
        <SectionHeader title="Horario de atención" />
        {franjas.length === 0 ? (
          <p style={{ fontSize: 12, marginBottom: 14 }}>
            Todavía no cargaste el horario de atención de esta sede. Agregá al menos una franja para poder programar clases.
          </p>
        ) : (
          <div className="stack-gap" style={{ gap: 8, marginBottom: 14 }}>
            {franjas.map((f) => (
              <div key={f.id} className="pick-item" style={{ cursor: 'default' }}>
                <span className="ops-strong">
                  {f.apertura.slice(0, 5)} – {f.cierre.slice(0, 5)}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: 'var(--coral)' }}
                  onClick={() => void handleEliminarFranja(f.id)}
                  disabled={eliminandoFranja === f.id}
                  aria-label="Eliminar franja"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label>
            <span className="field-label">APERTURA</span>
            <input className="field-input" type="time" value={apertura} onChange={(e) => setApertura(e.target.value)} />
          </label>
          <label>
            <span className="field-label">CIERRE</span>
            <input className="field-input" type="time" value={cierre} onChange={(e) => setCierre(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={() => void handleAgregarFranja()} disabled={guardandoFranja}>
            <Plus size={15} aria-hidden /> {guardandoFranja ? 'Agregando...' : 'Agregar franja'}
          </button>
        </div>
      </section>
    </>
  );
}
