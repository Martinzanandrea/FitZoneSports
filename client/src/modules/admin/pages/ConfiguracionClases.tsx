import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Pencil, Plus, RefreshCw, RotateCcw, Trash2, UserCog } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi, type ImpactoBaja, type ReglasClases } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { instructoresApi, type Instructor } from '../../instructores/instructores.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { Badge } from '../../../shared/components/atoms';
import { Pagination } from '../../../shared/components/molecules';
import { Select } from '../../../shared/components/atoms';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { colorPorTipo } from '../../../shared/utils/colorClase';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { nombreDia } from './NuevaClasePanel';

type Tab = 'ACTIVIDADES' | 'INSTRUCTORES' | 'RECURRENCIA';
type FiltroEstado = 'TODAS' | 'ACTIVAS' | 'BAJAS';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'ACTIVIDADES', label: 'Actividades' },
  { id: 'INSTRUCTORES', label: 'Instructores' },
  { id: 'RECURRENCIA', label: 'Recurrencia' },
];

const POR_PAGINA = 10;
const MAX_TIPO = 80;

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

function resumenHorarios(c: Clase): string {
  if (!c.horarios.length) return '—';
  return [...c.horarios]
    .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
    .map((h) => `${nombreDia(h.diaSemana)} ${h.horaInicio.slice(0, 5)}-${h.horaFin.slice(0, 5)}`)
    .join(' · ');
}

// Trae TODOS los instructores recorriendo las páginas del servidor y deja los activos.
async function cargarInstructoresActivos(): Promise<Instructor[]> {
  const activos: Instructor[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await instructoresApi.getAll(page, 100);
    activos.push(...r.data.filter((i) => i.activo));
    if (page >= r.totalPages) break;
  }
  return activos;
}

type Accion =
  | { tipo: 'EDITAR'; clase: Clase }
  | { tipo: 'INSTRUCTOR'; clase: Clase }
  | { tipo: 'BAJA'; clase: Clase }
  | null;

export function ConfiguracionClases() {
  useTitulo('Configurar clases');
  const { user } = useAuth();
  const navigate = useNavigate();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  const [tab, setTab] = useState<Tab>('ACTIVIDADES');

  const [sedes, setSedes] = useState<Sede[]>([]);
  // Solo el GG elige sede; el backend ya acota las clases del GS a la suya.
  const [sedeFiltro, setSedeFiltro] = useState('TODAS');
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>('TODAS');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [clases, setClases] = useState<Clase[]>([]);
  const [porTipo, setPorTipo] = useState<Array<{ tipoClase: string; activas: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const [accion, setAccion] = useState<Accion>(null);
  const [errorModal, setErrorModal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [formTipo, setFormTipo] = useState('');
  const [formCapacidad, setFormCapacidad] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [impacto, setImpacto] = useState<ImpactoBaja | null>(null);
  const [impactoError, setImpactoError] = useState(false);
  const [entiendo, setEntiendo] = useState(false);

  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [cargandoInstructores, setCargandoInstructores] = useState(false);
  const [errorInstructores, setErrorInstructores] = useState(false);
  const [reglas, setReglas] = useState<ReglasClases | null>(null);
  const [errorReglas, setErrorReglas] = useState(false);

  const sedeParam = esGG && sedeFiltro !== 'TODAS' ? sedeFiltro : undefined;
  const activaParam = estadoFiltro === 'ACTIVAS' ? true : estadoFiltro === 'BAJAS' ? false : undefined;

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((r) => setSedes(r.data)).catch(() => setSedes([]));
  }, [esGG]);

  // Lista paginada en el servidor + conteo por tipo (también del servidor).
  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    Promise.all([clasesApi.getAll(sedeParam, page, POR_PAGINA, activaParam), clasesApi.getResumenTipos(sedeParam)])
      .then(([lista, tipos]) => {
        if (!viva) return;
        setClases(lista.data);
        setTotalPages(lista.totalPages);
        setTotal(lista.total);
        setPorTipo(tipos);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setLoading(false));
    return () => {
      viva = false;
    };
  }, [sedeParam, activaParam, page, recarga]);

  const cargarInstructores = useCallback(() => {
    setCargandoInstructores(true);
    setErrorInstructores(false);
    cargarInstructoresActivos()
      .then(setInstructores)
      .catch(() => setErrorInstructores(true))
      .finally(() => setCargandoInstructores(false));
  }, []);

  useEffect(() => {
    if (tab === 'INSTRUCTORES' || accion?.tipo === 'INSTRUCTOR') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarInstructores();
    }
  }, [tab, accion?.tipo, cargarInstructores]);

  const cargarReglas = useCallback(() => {
    setErrorReglas(false);
    clasesApi
      .getReglas()
      .then(setReglas)
      .catch(() => setErrorReglas(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'RECURRENCIA') cargarReglas();
  }, [tab, cargarReglas]);

  // Al elegir "dar de baja" se pide cuánto se va a cancelar, con datos reales.
  useEffect(() => {
    if (accion?.tipo !== 'BAJA') return;
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImpacto(null);
    setImpactoError(false);
    clasesApi
      .getImpactoBaja(accion.clase.id)
      .then((r) => viva && setImpacto(r))
      .catch(() => viva && setImpactoError(true));
    return () => {
      viva = false;
    };
  }, [accion]);

  const hayFiltros = sedeFiltro !== 'TODAS' || estadoFiltro !== 'TODAS';
  const opcionesInstructor = useMemo(() => instructores.map((i) => ({ value: i.id, label: i.especialidad ? `${i.nombre} — ${i.especialidad}` : i.nombre })), [instructores]);

  function abrir(a: Exclude<Accion, null>) {
    setErrorModal('');
    setEntiendo(false);
    if (a.tipo === 'EDITAR') {
      setFormTipo(a.clase.tipoClase);
      setFormCapacidad(String(a.clase.capacidad));
    }
    if (a.tipo === 'INSTRUCTOR') setInstructorId(a.clase.instructor.id);
    setAccion(a);
  }

  function cerrar() {
    if (guardando) return;
    setAccion(null);
    setErrorModal('');
  }

  function terminar(texto: string) {
    setAccion(null);
    setMsg({ type: 'ok', text: texto });
    setRecarga((n) => n + 1);
  }

  async function guardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (accion?.tipo !== 'EDITAR') return;
    const capacidad = Number(formCapacidad);
    if (!formTipo.trim() || !Number.isInteger(capacidad) || capacidad < 1) {
      setErrorModal('Completá el tipo y una capacidad entera de 1 o más.');
      return;
    }
    setGuardando(true);
    setErrorModal('');
    try {
      await clasesApi.actualizar(accion.clase.id, { tipoClase: formTipo.trim(), capacidad });
      terminar('Clase actualizada.');
    } catch (err) {
      setErrorModal(mensajeDe(err, 'No se pudo actualizar la clase.'));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarInstructor(e: FormEvent) {
    e.preventDefault();
    if (accion?.tipo !== 'INSTRUCTOR' || !instructorId) return;
    setGuardando(true);
    setErrorModal('');
    try {
      await clasesApi.asignarInstructor(accion.clase.id, instructorId);
      terminar('Instructor reasignado.');
    } catch (err) {
      setErrorModal(mensajeDe(err, 'No se pudo reasignar el instructor.'));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarBaja() {
    if (accion?.tipo !== 'BAJA') return;
    setGuardando(true);
    setErrorModal('');
    try {
      const r = await clasesApi.desactivar(accion.clase.id);
      const n = r.resumenBaja?.reservasCanceladas ?? 0;
      terminar(`Clase dada de baja. Se cancelaron ${n} reserva(s) futura(s) y se avisa a los socios afectados.`);
    } catch (err) {
      setErrorModal(mensajeDe(err, 'No se pudo dar de baja la clase.'));
    } finally {
      setGuardando(false);
    }
  }

  async function regenerar(c: Clase) {
    setTrabajando(c.id);
    setMsg(null);
    try {
      const r = await clasesApi.generarOcurrencias(c.id);
      setMsg({ type: 'ok', text: `Fechas regeneradas: ${r.ocurrenciasGeneradas} nueva(s).` });
      setRecarga((n) => n + 1);
    } catch (err) {
      setMsg({ type: 'err', text: mensajeDe(err, 'No se pudieron regenerar las fechas.') });
    } finally {
      setTrabajando(null);
    }
  }

  async function reactivar(c: Clase) {
    setTrabajando(c.id);
    setMsg(null);
    try {
      const r = await clasesApi.reactivar(c.id);
      setMsg({
        type: 'ok',
        text: `Clase reactivada. Las reservas canceladas por la baja no se restauran; cada socio vuelve a reservar. Fechas reabiertas: ${r.ocurrenciasReabiertas}.`,
      });
      setRecarga((n) => n + 1);
    } catch (err) {
      setMsg({ type: 'err', text: mensajeDe(err, 'No se pudo reactivar la clase.') });
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Configuración de clases</h2>
          <p>Actividades, instructores y cómo se generan las fechas.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      {tab === 'ACTIVIDADES' && (
        <>
          <section className="glass panel" aria-label="Tipos de actividad" style={{ marginBottom: 14 }}>
            <SectionHeader title="Clases activas por tipo" />
            {loading && porTipo.length === 0 ? (
              <LoadingState rows={2} label="Cargando actividades" />
            ) : porTipo.length === 0 ? (
              <EmptyState icon={BookOpen} title="Todavía no hay clases activas" description="Cuando crees una clase, su tipo aparece acá." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {porTipo.map((t) => {
                  const color = colorPorTipo(t.tipoClase);
                  return (
                    <div key={t.tipoClase} className="list-row" style={{ background: color.fondo, borderRadius: 14, borderLeft: `3px solid ${color.borde}`, padding: '10px 12px' }}>
                      <div className="row-main">
                        <strong>{t.tipoClase}</strong>
                        <span>{t.activas} activa(s)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass panel" aria-label="Clases">
            <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
              {esGG && (
                <div className="select-field">
                  <span className="field-label">SEDE</span>
                  <Select
                    value={sedeFiltro}
                    onChange={(v) => {
                      setSedeFiltro(v);
                      setPage(1);
                    }}
                    ariaLabel="Sede"
                    opciones={[{ value: 'TODAS', label: 'Todas las sedes' }, ...sedes.map((s) => ({ value: s.id, label: s.nombre }))]}
                  />
                </div>
              )}
              <div className="select-field">
                <span className="field-label">ESTADO</span>
                <Select
                  value={estadoFiltro}
                  onChange={(v) => {
                    setEstadoFiltro(v as FiltroEstado);
                    setPage(1);
                  }}
                  ariaLabel="Estado"
                  opciones={[
                    { value: 'TODAS', label: 'Activas y dadas de baja' },
                    { value: 'ACTIVAS', label: 'Solo activas' },
                    { value: 'BAJAS', label: 'Solo dadas de baja' },
                  ]}
                />
              </div>
              <div className="select-field" style={{ alignSelf: 'end' }}>
                <Link to="/admin/clases" className="btn btn-secondary">
                  <Plus size={14} aria-hidden /> Crear clase en el calendario
                </Link>
              </div>
            </div>

            {loading ? (
              <LoadingState rows={4} label="Cargando clases" />
            ) : error ? (
              <ErrorState title="No pudimos cargar las clases" onRetry={() => setRecarga((n) => n + 1)} />
            ) : clases.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={hayFiltros ? 'Ninguna clase coincide con el filtro' : 'Todavía no hay clases'}
                description={hayFiltros ? 'Probá con otra sede o estado.' : 'Creá la primera clase desde el calendario de una sede.'}
              />
            ) : (
              <>
                <SectionHeader title="Clases" description={`${total} en total`} />
                <div className="ops-table" style={{ ['--cols' as string]: '1.1fr 1fr 1fr 0.6fr 1.8fr 0.7fr 2.4fr' }}>
                  <div className="ops-row ops-head">
                    <span>TIPO</span>
                    <span>SEDE</span>
                    <span>INSTRUCTOR</span>
                    <span>CAPACIDAD</span>
                    <span>HORARIOS</span>
                    <span>ESTADO</span>
                    <span>ACCIONES</span>
                  </div>
                  {clases.map((c) => {
                    const color = colorPorTipo(c.tipoClase);
                    const ocupado = trabajando === c.id;
                    return (
                      <div className="ops-row" key={c.id} style={c.activa ? undefined : { opacity: 0.7 }}>
                        <span data-label="TIPO" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: color.borde, flex: 'none' }} />
                          <strong style={{ color: 'var(--text)' }}>{c.tipoClase}</strong>
                        </span>
                        <span data-label="SEDE">{c.sede.nombre}</span>
                        <span data-label="INSTRUCTOR">{c.instructor.nombre}</span>
                        <span data-label="CAPACIDAD">{c.capacidad}</span>
                        <span data-label="HORARIOS">{resumenHorarios(c)}</span>
                        <span data-label="ESTADO">
                          <Badge variant={c.activa ? 'success' : 'neutral'}>{c.activa ? 'Activa' : 'Baja'}</Badge>
                        </span>
                        <span data-label="ACCIONES" className="inline-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
                          {c.activa ? (
                            <>
                              <button className="btn btn-ghost" disabled={ocupado} onClick={() => abrir({ tipo: 'EDITAR', clase: c })} aria-label={`Editar ${c.tipoClase}`}>
                                <Pencil size={13} aria-hidden /> Editar
                              </button>
                              <button className="btn btn-ghost" disabled={ocupado} onClick={() => abrir({ tipo: 'INSTRUCTOR', clase: c })} aria-label={`Reasignar instructor de ${c.tipoClase}`}>
                                <UserCog size={13} aria-hidden /> Instructor
                              </button>
                              <button className="btn btn-ghost" disabled={ocupado} onClick={() => void regenerar(c)} aria-label={`Regenerar fechas de ${c.tipoClase}`}>
                                <RefreshCw size={13} aria-hidden /> Fechas
                              </button>
                              <button className="btn btn-ghost" style={{ color: 'var(--coral)' }} disabled={ocupado} onClick={() => abrir({ tipo: 'BAJA', clase: c })} aria-label={`Dar de baja ${c.tipoClase}`}>
                                <Trash2 size={13} aria-hidden /> Dar de baja
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-secondary" disabled={ocupado} onClick={() => void reactivar(c)} aria-label={`Reactivar ${c.tipoClase}`}>
                              <RotateCcw size={13} aria-hidden /> {ocupado ? 'Reactivando...' : 'Reactivar'}
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </section>
        </>
      )}

      {tab === 'INSTRUCTORES' && (
        <section className="glass panel" aria-label="Instructores activos">
          <div className="filters" style={{ boxShadow: 'none', marginBottom: 14, justifyContent: 'space-between' }}>
            <SectionHeader title="Instructores activos" description={`${instructores.length} en total`} />
            <Link to="/admin/instructores" className="btn btn-primary">
              <Plus size={14} aria-hidden /> Alta de instructor
            </Link>
          </div>
          {cargandoInstructores ? (
            <LoadingState rows={3} label="Cargando instructores" />
          ) : errorInstructores ? (
            <ErrorState title="No pudimos cargar los instructores" onRetry={cargarInstructores} />
          ) : instructores.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Todavía no hay instructores activos"
              description="Dalos de alta para poder asignarlos a las clases."
              action={
                <Link to="/admin/instructores" className="btn btn-primary">
                  Ir a Instructores
                </Link>
              }
            />
          ) : (
            <div className="stack-list">
              {instructores.map((i) => (
                <div className="list-row" key={i.id}>
                  <div className="row-main">
                    <strong>{i.nombre}</strong>
                    <span>{i.especialidad || 'Sin especialidad cargada'}</span>
                  </div>
                  <Link to={`/admin/instructores/${i.id}`} className="btn btn-secondary">
                    Ver detalle
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'RECURRENCIA' && (
        <section className="glass panel" aria-label="Recurrencia">
          <SectionHeader title="Reglas vigentes" description="Valores reales del sistema" />
          {errorReglas ? (
            <ErrorState title="No pudimos cargar las reglas" onRetry={cargarReglas} />
          ) : !reglas ? (
            <LoadingState rows={3} label="Cargando reglas" />
          ) : (
            <div className="stack-list">
              <div className="list-row">
                <div className="row-main">
                  <strong>Reserva</strong>
                  <span>El socio puede reservar hasta {reglas.horasLimiteReservaPropia} h antes del inicio.</span>
                </div>
              </div>
              <div className="list-row">
                <div className="row-main">
                  <strong>Cancelación</strong>
                  <span>Se puede cancelar una reserva hasta {reglas.horasLimiteCancelacion} h antes del inicio.</span>
                </div>
              </div>
              <div className="list-row">
                <div className="row-main">
                  <strong>Anotar a otra persona</strong>
                  <span>El personal puede anotar a un socio hasta {reglas.minutosLimiteReservaStaff} minutos antes del inicio.</span>
                </div>
              </div>
              <div className="list-row">
                <div className="row-main">
                  <strong>Generación de fechas</strong>
                  <span>
                    Cada clase mantiene generadas las próximas {reglas.semanasVentanaOcurrencias} semanas: se generan al crearla y un proceso automático semanal repone la ventana.
                  </span>
                </div>
              </div>
              <div className="list-row">
                <div className="row-main">
                  <strong>Horarios</strong>
                  <span>
                    Al crear una clase (y al reactivarla) el sistema verifica que su horario no se superponga con otra clase activa de la misma sede.
                  </span>
                </div>
              </div>
              <div className="list-row">
                <div className="row-main">
                  <strong>Dar de baja</strong>
                  <span>
                    La baja es lógica: la clase deja de ofrecerse, se cancelan sus fechas y reservas futuras (sin promover la lista de espera) y se avisa a los socios afectados. Para cambiar el horario, dá de baja la clase y creá otra.
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {accion?.tipo === 'EDITAR' && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label="Editar clase" onSubmit={(e) => void guardarEdicion(e)}>
            <SectionHeader title="Editar clase" description={`${accion.clase.sede.nombre} · ${resumenHorarios(accion.clase)}`} />
            <div className="stack-gap">
              <label>
                <span className="field-label">TIPO DE CLASE</span>
                <input className="field-input" value={formTipo} maxLength={MAX_TIPO} onChange={(e) => setFormTipo(e.target.value)} required />
              </label>
              <label>
                <span className="field-label">CAPACIDAD</span>
                <input className="field-input" type="number" min={1} step={1} value={formCapacidad} onChange={(e) => setFormCapacidad(e.target.value)} required />
              </label>
              <p style={{ fontSize: 11 }}>El horario no se edita: para cambiarlo, dá de baja la clase y creá otra. La capacidad no puede ser menor a las reservas ya confirmadas.</p>
              {errorModal && (
                <p role="alert" className="notice notice-err">
                  {errorModal}
                </p>
              )}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={guardando} onClick={cerrar}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {accion?.tipo === 'INSTRUCTOR' && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label="Reasignar instructor" onSubmit={(e) => void guardarInstructor(e)}>
            <SectionHeader title="Reasignar instructor" description={`${accion.clase.tipoClase} · ${accion.clase.sede.nombre}`} />
            <div className="stack-gap">
              {cargandoInstructores ? (
                <LoadingState rows={1} label="Cargando instructores" />
              ) : errorInstructores ? (
                <ErrorState title="No pudimos cargar los instructores" onRetry={cargarInstructores} />
              ) : (
                <div>
                  <span className="field-label">INSTRUCTOR</span>
                  <Select value={instructorId} onChange={setInstructorId} ariaLabel="Instructor" placeholder="Elegí un instructor..." opciones={opcionesInstructor} />
                </div>
              )}
              {errorModal && (
                <p role="alert" className="notice notice-err">
                  {errorModal}
                </p>
              )}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={guardando || !instructorId || instructorId === accion.clase.instructor.id}>
                  {guardando ? 'Guardando...' : 'Reasignar'}
                </button>
                <button type="button" className="btn btn-secondary" disabled={guardando} onClick={cerrar}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {accion?.tipo === 'BAJA' && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
          <div className="glass panel modal-card" role="alertdialog" aria-modal="true" aria-label="Dar de baja la clase">
            <SectionHeader title="Dar de baja la clase" description={`${accion.clase.tipoClase} · ${accion.clase.sede.nombre}`} />
            {impactoError ? (
              <ErrorState title="No pudimos calcular el impacto de la baja" onRetry={() => setAccion({ ...accion })} />
            ) : !impacto ? (
              <LoadingState rows={2} label="Calculando el impacto" />
            ) : (
              <div className="stack-gap">
                <p style={{ fontSize: 13 }}>
                  Se cancelarán <strong style={{ color: 'var(--text)' }}>{impacto.reservasFuturas} reserva(s) futura(s)</strong> en{' '}
                  <strong style={{ color: 'var(--text)' }}>{impacto.ocurrenciasFuturas} fecha(s)</strong>, de{' '}
                  <strong style={{ color: 'var(--text)' }}>{impacto.sociosAfectados} socio(s)</strong>. Se les avisará desde la campanita y por mail que su clase fue cancelada y que reserven en los horarios disponibles.
                </p>
                <p style={{ fontSize: 11 }}>
                  Las reservas pasadas y las asistencias no se tocan. Si reactivás la clase, las reservas canceladas no se restauran.
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, minHeight: 36 }}>
                  <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} />
                  Entiendo que se cancelarán estas reservas y se avisará a los socios.
                </label>
                {errorModal && (
                  <p role="alert" className="notice notice-err">
                    {errorModal}
                  </p>
                )}
                <div className="inline-actions">
                  <button className="btn btn-danger" disabled={guardando || !entiendo} onClick={() => void confirmarBaja()}>
                    {guardando ? 'Dando de baja...' : 'Sí, dar de baja'}
                  </button>
                  <button className="btn btn-secondary" disabled={guardando} onClick={cerrar}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
