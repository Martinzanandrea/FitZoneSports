import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { BookOpen, UserX } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { instructoresApi, type Instructor } from '../instructores.api';
import { clasesApi } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { Avatar, Badge } from '../../../shared/components/ui';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { TipoActor } from '../../../shared/types/enums';
import { ROLES_GERENTES } from '../../../shared/types/roles';
import { useTitulo } from '../../../shared/hooks/useTitulo';

// Convención JS getDay() del backend: 0 = Domingo ... 6 = Sábado.
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function InstructorDetalle() {
  useTitulo('Detalle de instructor');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeEditar = !!user && ROLES_GERENTES.includes(user.tipoActor);
  // Activar/desactivar es solo del GG; el GS ve el estado en solo lectura.
  const puedeActivar = user?.tipoActor === TipoActor.GERENTE_GENERAL;

  const [inst, setInst] = useState<Instructor | null>(null);
  const [clases, setClases] = useState<Clase[]>([]);
  const [form, setForm] = useState({ nombre: '', especialidad: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cambiandoActivo, setCambiandoActivo] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const cargar = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    // Las clases vienen acotadas por el backend según el rol (el GS ve solo las de su sede).
    Promise.all([instructoresApi.getOne(id), clasesApi.getAll(undefined, 1, 100).catch(() => ({ data: [] as Clase[] }))])
      .then(([instructor, todasClases]) => {
        setInst(instructor);
        setForm({ nombre: instructor.nombre, especialidad: instructor.especialidad ?? '' });
        setClases(todasClases.data.filter((c) => c.instructor.id === id));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setMsg(null);
    try {
      const upd = await instructoresApi.update(id, { nombre: form.nombre, especialidad: form.especialidad || null });
      setInst(upd);
      setMsg({ type: 'ok', text: 'Cambios guardados.' });
    } catch (e) {
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo guardar.') });
    } finally {
      setSaving(false);
    }
  }

  async function alternarActivo() {
    if (!id || !inst) return;
    setCambiandoActivo(true);
    setMsg(null);
    try {
      const upd = await instructoresApi.update(id, { activo: !inst.activo });
      setInst(upd);
      setMsg({ type: 'ok', text: upd.activo ? 'Instructor activado.' : 'Instructor desactivado.' });
    } catch (e) {
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo cambiar el estado.') });
    } finally {
      setCambiandoActivo(false);
    }
  }

  if (loading) return <LoadingState rows={3} label="Cargando instructor" />;
  if (error || !inst) {
    return <ErrorState title="No pudimos cargar el instructor" description="Puede que no exista o que no tengas acceso." onRetry={cargar} />;
  }

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>{inst.nombre}</h2>
          <p>{inst.especialidad ?? 'Sin especialidad'}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/instructores')}>
          Volver al listado
        </button>
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      <section className="glass panel" aria-label="Datos del instructor" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Avatar name={inst.nombre} size={48} />
          <Badge variant={inst.activo ? 'success' : 'neutral'}>{inst.activo ? 'Activo' : 'Inactivo'}</Badge>
          {puedeActivar && (
            <button className="btn btn-secondary" disabled={cambiandoActivo} onClick={() => void alternarActivo()}>
              {cambiandoActivo ? 'Guardando...' : inst.activo ? 'Desactivar' : 'Activar'}
            </button>
          )}
        </div>
        {puedeEditar ? (
          <div className="stack-gap">
            <label>
              <span className="field-label">NOMBRE</span>
              <input className="field-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label>
              <span className="field-label">ESPECIALIDAD</span>
              <input className="field-input" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} />
            </label>
            <div className="inline-actions">
              <button className="btn btn-primary" disabled={saving || !form.nombre.trim()} onClick={() => void handleSave()}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="glass panel" aria-label="Clases asociadas">
        <SectionHeader title={`Clases asociadas (${clases.length})`} />
        {clases.length === 0 ? (
          <EmptyState icon={BookOpen} title="Sin clases asignadas" description="Cuando se le asigne una clase, aparece acá." />
        ) : (
          <div className="stack-list">
            {clases.map((c) => (
              <Link key={c.id} to="/admin/clases" className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="row-main">
                  <strong>
                    {c.tipoClase} · {c.sede.nombre}
                  </strong>
                  <span>
                    {(c.horarios ?? [])
                      .map((h) => `${DIAS_SEMANA[h.diaSemana] ?? `Día ${h.diaSemana}`} ${h.horaInicio.slice(0, 5)}–${h.horaFin.slice(0, 5)}`)
                      .join(' · ') || 'Sin horarios'}
                    {' · '}cupo {c.capacidad}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      {!puedeEditar && (
        <p style={{ marginTop: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserX size={14} aria-hidden /> Solo los gerentes pueden editar instructores.
        </p>
      )}
    </>
  );
}
