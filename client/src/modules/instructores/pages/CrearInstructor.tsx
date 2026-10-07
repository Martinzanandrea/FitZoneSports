import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, GraduationCap, Plus, Users, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { instructoresApi, type Instructor } from '../instructores.api';
import { Avatar, Badge, Pagination } from '../../../shared/components/ui';
import { MetricCard } from '../../../shared/components/MetricCard';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { TipoActor } from '../../../shared/types/enums';
import { ROLES_GERENTES } from '../../../shared/types/roles';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function CrearInstructor() {
  useTitulo('Instructores');
  const { user } = useAuth();
  // El backend es la autoridad; acá solo se oculta lo que el rol no puede usar.
  const puedeCrear = !!user && ROLES_GERENTES.includes(user.tipoActor);
  const puedeActivar = user?.tipoActor === TipoActor.GERENTE_GENERAL;

  const [form, setForm] = useState({ nombre: '', especialidad: '', telefono: '' });
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [errorForm, setErrorForm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [total, setTotal] = useState(0);
  const [activos, setActivos] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(false);
    instructoresApi
      .getAll(page)
      .then((res) => {
        setInstructores(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    // Conteo sobre una muestra amplia (no hay agregación en el backend).
    instructoresApi
      .getAll(1, 100)
      .then((res) => setActivos(res.data.filter((i) => i.activo).length))
      .catch(() => setActivos(null));
  }, [page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirModal() {
    setForm({ nombre: '', especialidad: '', telefono: '' });
    setErrorForm('');
    setModalAbierto(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErrorForm('');
    setSubmitting(true);
    try {
      const payload: { nombre: string; especialidad?: string; telefono?: string } = { nombre: form.nombre.trim() };
      if (form.especialidad.trim()) payload.especialidad = form.especialidad.trim();
      if (form.telefono.trim()) payload.telefono = form.telefono.trim();
      const instructor = await instructoresApi.create(payload);
      setMsg({ type: 'ok', text: `${instructor.nombre} creado correctamente.` });
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setErrorForm(mensajeDe(err, 'No se pudo crear el instructor. Revisá los datos.'));
    } finally {
      setSubmitting(false);
    }
  }

  // Solo el GG: el backend responde 403 si lo intenta el GS.
  async function alternarActivo(ins: Instructor) {
    setCambiandoId(ins.id);
    setMsg(null);
    try {
      const upd = await instructoresApi.update(ins.id, { activo: !ins.activo });
      setInstructores((prev) => prev.map((i) => (i.id === ins.id ? { ...i, activo: upd.activo } : i)));
      setActivos((n) => (n === null ? n : n + (upd.activo ? 1 : -1)));
    } catch (err) {
      setMsg({ type: 'err', text: mensajeDe(err, 'No se pudo cambiar el estado.') });
    } finally {
      setCambiandoId(null);
    }
  }

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Instructores</h2>
          <p>Listado y alta de instructores. Tocá uno para ver el detalle.</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={abrirModal}>
            <Plus size={16} aria-hidden /> Nuevo instructor
          </button>
        )}
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Total de instructores" value={loading && !instructores.length ? '—' : String(total)} change="registrados" icon={Users} />
        <MetricCard label="Activos" value={activos === null ? '—' : String(activos)} change="disponibles para clases" icon={CheckCircle2} />
      </div>

      <section className="glass panel" aria-label="Listado de instructores">
        <SectionHeader title={`Instructores${total ? ` (${total})` : ''}`} />
        {loading ? (
          <LoadingState rows={4} label="Cargando instructores" />
        ) : error ? (
          <ErrorState title="No pudimos cargar los instructores" onRetry={cargar} />
        ) : instructores.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Todavía no hay instructores" description="Dá de alta al primero para poder asignarlo a clases." />
        ) : (
          <div className="stack-list">
            {instructores.map((ins) => (
              <div className="list-row" key={ins.id}>
                <Link to={`/admin/instructores/${ins.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                  <Avatar name={ins.nombre} size={40} />
                  <div className="row-main">
                    <strong>{ins.nombre}</strong>
                    <span>{ins.especialidad ?? 'Sin especialidad'}</span>
                  </div>
                </Link>
                <Badge variant={ins.activo ? 'success' : 'neutral'}>{ins.activo ? 'Activo' : 'Inactivo'}</Badge>
                {puedeActivar && (
                  <button className="btn btn-secondary" disabled={cambiandoId === ins.id} onClick={() => void alternarActivo(ins)} aria-label={`${ins.activo ? 'Desactivar' : 'Activar'} a ${ins.nombre}`}>
                    {ins.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      {modalAbierto && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setModalAbierto(false)}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label="Nuevo instructor" onSubmit={handleSubmit}>
            <SectionHeader
              title="Nuevo instructor"
              description="Completá los datos para darlo de alta."
              action={
                <button type="button" className="icon-button" onClick={() => setModalAbierto(false)} aria-label="Cerrar">
                  <X size={16} />
                </button>
              }
            />
            <div className="stack-gap">
              <label>
                <span className="field-label">NOMBRE *</span>
                <input className="field-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label>
                <span className="field-label">ESPECIALIDAD</span>
                <input className="field-input" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} />
              </label>
              <label>
                <span className="field-label">TELÉFONO</span>
                <input className="field-input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </label>
              {errorForm && (
                <p role="alert" className="notice notice-err">
                  {errorForm}
                </p>
              )}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creando...' : 'Crear instructor'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setModalAbierto(false)}>
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
