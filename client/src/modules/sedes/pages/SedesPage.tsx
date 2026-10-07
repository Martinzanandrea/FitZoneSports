import { type FormEvent, useEffect, useState } from 'react';
import { Activity, Building2, MapPin, Pencil, Plus, Power, Tag, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sedesApi } from '../sedes.api';
import type { CreateSedePayload, Sede } from '../sedes.types';
import { Badge, Pagination } from '../../../shared/components/ui';
import { MetricCard } from '../../../shared/components/MetricCard';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const EMPTY_FORM: CreateSedePayload = { nombre: '', direccion: '', aforoMaximo: 100 };

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function SedesPage() {
  useTitulo('Sedes');
  const navigate = useNavigate();
  // Desde el detalle de una sede se llega con state.nueva para abrir el alta directo.
  const abrirAlEntrar = Boolean((useLocation().state as { nueva?: boolean } | null)?.nueva);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [form, setForm] = useState<CreateSedePayload>(EMPTY_FORM);
  const [formAbierto, setFormAbierto] = useState(abrirAlEntrar);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    sedesApi
      .getAll(page)
      .then((res) => {
        if (!viva) return;
        setSedes(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  function abrirNueva() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrorForm('');
    setFormAbierto(true);
  }

  function abrirEditar(sede: Sede) {
    setForm({ nombre: sede.nombre, direccion: sede.direccion, aforoMaximo: sede.aforoMaximo });
    setEditingId(sede.id);
    setErrorForm('');
    setFormAbierto(true);
  }

  function cerrarForm() {
    setFormAbierto(false);
    setEditingId(null);
    setErrorForm('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setErrorForm('');
    try {
      const payload = { ...form, aforoMaximo: Number(form.aforoMaximo) };
      if (editingId) {
        await sedesApi.update(editingId, payload);
        setMsg({ type: 'ok', text: 'Sede actualizada.' });
      } else {
        await sedesApi.create(payload);
        setMsg({ type: 'ok', text: 'Sede creada.' });
      }
      cerrarForm();
      setRecarga((n) => n + 1);
    } catch (e) {
      setErrorForm(mensajeDe(e, editingId ? 'No se pudo actualizar la sede. Revisá los datos.' : 'No se pudo crear la sede. Revisá los datos.'));
    } finally {
      setGuardando(false);
    }
  }

  async function toggleSede(sede: Sede) {
    setMsg(null);
    try {
      const actualizada = await sedesApi.update(sede.id, { activa: !sede.activa });
      setSedes((actuales) => actuales.map((s) => (s.id === sede.id ? actualizada : s)));
    } catch (e) {
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo cambiar el estado de la sede.') });
    }
  }

  const sinDatos = cargando && sedes.length === 0;
  const activas = sedes.filter((s) => s.activa).length;
  const aforo = sedes.reduce((acc, s) => acc + s.aforoMaximo, 0);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Sedes</h2>
          <p>Administrá las sucursales de FitZone.</p>
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/admin/precios')}>
            <Tag size={15} aria-hidden /> Configurar precios
          </button>
          <button className="btn btn-primary" onClick={abrirNueva}>
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
        <MetricCard label="Total de sedes" value={sinDatos ? '—' : String(total)} change="en la red" icon={Building2} />
        <MetricCard label="Sedes activas" value={sinDatos ? '—' : String(activas)} change="en esta página" icon={Activity} />
        <MetricCard label="Aforo máximo" value={sinDatos ? '—' : String(aforo)} change="suma de esta página" icon={Users} />
      </div>

      {cargando ? (
        <LoadingState rows={3} label="Cargando sedes" />
      ) : error ? (
        <ErrorState title="No pudimos cargar las sedes" onRetry={() => setRecarga((n) => n + 1)} />
      ) : sedes.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Todavía no hay sedes"
          description="Creá la primera sucursal para comenzar."
          action={
            <button className="btn btn-primary" onClick={abrirNueva}>
              <Plus size={16} aria-hidden /> Nueva sede
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {sedes.map((sede) => (
            <article key={sede.id} className="glass panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 15, color: 'var(--text)' }}>{sede.nombre}</strong>
                  <p style={{ marginTop: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} aria-hidden /> {sede.direccion}
                  </p>
                </div>
                <Badge variant={sede.activa ? 'success' : 'neutral'}>{sede.activa ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              <p style={{ fontSize: 12 }}>
                Aforo máximo: <strong style={{ color: 'var(--text)' }}>{sede.aforoMaximo}</strong>
              </p>
              <div className="inline-actions" style={{ marginTop: 'auto' }}>
                <Link to={`/admin/sedes/${sede.id}`} className="btn btn-primary">
                  Ver detalle
                </Link>
                <button className="btn btn-secondary" onClick={() => abrirEditar(sede)}>
                  <Pencil size={14} aria-hidden /> Editar
                </button>
                <button className="btn btn-secondary" onClick={() => void toggleSede(sede)}>
                  <Power size={14} aria-hidden /> {sede.activa ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {formAbierto && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrarForm()}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar sede' : 'Nueva sede'} onSubmit={handleSubmit}>
            <SectionHeader title={editingId ? 'Editar sede' : 'Nueva sede'} />
            <div className="stack-gap">
              <label>
                <span className="field-label">NOMBRE</span>
                <input className="field-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label>
                <span className="field-label">DIRECCIÓN</span>
                <input className="field-input" required value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              </label>
              <label>
                <span className="field-label">AFORO MÁXIMO</span>
                <input className="field-input" required min={1} type="number" value={form.aforoMaximo} onChange={(e) => setForm({ ...form, aforoMaximo: Number(e.target.value) })} />
              </label>
              {errorForm && (
                <p role="alert" className="notice notice-err">
                  {errorForm}
                </p>
              )}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear sede'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cerrarForm}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
