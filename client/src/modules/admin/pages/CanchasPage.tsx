import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, DollarSign, MapPin, Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi, tiposCanchaApi } from '../../canchas/canchas.api';
import { EstadoCancha, type Cancha, type CanchaPayload, type TipoCanchaCatalogo } from '../../canchas/canchas.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { Badge, Pagination, formatMoney } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { MetricCard } from '../../../shared/components/MetricCard';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

type CanchaForm = Omit<CanchaPayload, 'costoHoraBase'> & { costoHoraBase: string; estado: Cancha['estado'] };

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function CanchasPage() {
  useTitulo('Canchas');
  const navigate = useNavigate();
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  // La sede del Gerente de Sede va fija: no hay selector, así evitamos 403.
  const sedeFija = esGG ? null : user?.sedeId ?? null;

  const emptyForm = useMemo<CanchaForm>(
    () => ({ sedeId: sedeFija ?? '', nombre: '', tipoId: '', costoHoraBase: '', estado: EstadoCancha.ACTIVA }),
    [sedeFija],
  );

  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [tipos, setTipos] = useState<TipoCanchaCatalogo[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [ingresosMes, setIngresosMes] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [filtroSede, setFiltroSede] = useState('TODAS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  const [form, setForm] = useState<CanchaForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [aEliminar, setAEliminar] = useState<Cancha | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  // Catálogos auxiliares: sedes solo para el GG; tipos completos solo para el GG
  // (el GS usa los tipos activos del catálogo público).
  useEffect(() => {
    if (esGG) sedesApi.getAll(1, 100).then((r) => setSedes(r.data)).catch(() => setSedes([]));
    (esGG ? tiposCanchaApi.listarTodos() : tiposCanchaApi.listar()).then(setTipos).catch(() => setTipos([]));
  }, [esGG]);

  useEffect(() => {
    let viva = true;
    setCargando(true);
    setError(false);
    canchasApi
      .getAll(page)
      .then((res) => {
        if (!viva) return;
        setCanchas(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    canchasApi
      .getIngresosMes()
      .then((r) => viva && setIngresosMes(r.total))
      .catch(() => viva && setIngresosMes(null));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  // Los filtros y el conteo de mantenimiento aplican a la página actual.
  const filtradas = useMemo(
    () =>
      canchas.filter(
        (c) => (filtroSede === 'TODAS' || c.sede.id === filtroSede) && (filtroTipo === 'TODOS' || c.tipoId === filtroTipo),
      ),
    [canchas, filtroSede, filtroTipo],
  );
  const enMantenimiento = canchas.filter((c) => c.estado === EstadoCancha.MANTENIMIENTO).length;

  const abrirNueva = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setErrorForm('');
    setFormAbierto(true);
  }, [emptyForm]);

  function abrirEditar(c: Cancha) {
    setForm({ sedeId: c.sede.id, nombre: c.nombre, tipoId: c.tipoId, costoHoraBase: String(Number(c.costoHoraBase)), estado: c.estado });
    setEditingId(c.id);
    setErrorForm('');
    setFormAbierto(true);
  }

  function cerrarForm() {
    setFormAbierto(false);
    setEditingId(null);
    setErrorForm('');
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const sedeId = sedeFija ?? form.sedeId;
    if (!sedeId || !form.tipoId) {
      setErrorForm('Elegí la sede y el tipo de cancha.');
      return;
    }
    setGuardando(true);
    setErrorForm('');
    try {
      const payload = { sedeId, nombre: form.nombre.trim(), tipoId: form.tipoId, costoHoraBase: Number(form.costoHoraBase) };
      if (editingId) {
        const actualizada = await canchasApi.update(editingId, { ...payload, estado: form.estado });
        setMsg({ type: 'ok', text: actualizada.aviso ? `Cancha actualizada. ${actualizada.aviso.mensaje}` : 'Cancha actualizada.' });
      } else {
        await canchasApi.create(payload);
        setMsg({ type: 'ok', text: 'Cancha creada.' });
      }
      cerrarForm();
      setRecarga((n) => n + 1);
    } catch (err) {
      setErrorForm(mensajeDe(err, editingId ? 'No se pudo actualizar la cancha.' : 'No se pudo crear la cancha.'));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    setErrorEliminar('');
    try {
      await canchasApi.eliminar(aEliminar.id);
      setMsg({ type: 'ok', text: `Cancha "${aEliminar.nombre}" eliminada.` });
      setAEliminar(null);
      if (canchas.length === 1 && page > 1) setPage(page - 1);
      else setRecarga((n) => n + 1);
    } catch (err) {
      // El backend borra solo si la cancha no tiene reservas: mostramos su mensaje.
      setErrorEliminar(mensajeDe(err, 'No se pudo eliminar la cancha.'));
    } finally {
      setEliminando(false);
    }
  }

  const opcionesTipo = tipos.map((t) => ({ value: t.id, label: t.activo ? t.nombre : `${t.nombre} (inactivo)`, disabled: !t.activo }));

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Canchas</h2>
          <p>{esGG ? 'Administrá las canchas de todas las sedes.' : 'Administrá las canchas de tu sede.'}</p>
        </div>
        <div className="inline-actions">
          {esGG && (
            <button className="btn btn-secondary" onClick={() => navigate('/admin/canchas/tipos')}>
              <Pencil size={15} aria-hidden /> Gestionar tipos
            </button>
          )}
          <button className="btn btn-primary" onClick={abrirNueva}>
            <Plus size={16} aria-hidden /> Nueva cancha
          </button>
        </div>
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Total de canchas" value={cargando && !canchas.length ? '—' : String(total)} change={esGG ? 'en toda la red' : 'en tu sede'} icon={Building2} />
        <MetricCard label="En mantenimiento" value={cargando && !canchas.length ? '—' : String(enMantenimiento)} change="en esta página" icon={AlertTriangle} />
        <MetricCard label="Ingresos de canchas" value={ingresosMes === null ? '—' : formatMoney(ingresosMes)} change="pagos aprobados del mes" icon={DollarSign} />
      </div>

      <section className="glass panel" aria-label="Listado de canchas">
        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
          {esGG && (
            <div className="select-field">
              <span className="field-label">SEDE</span>
              <Select
                value={filtroSede}
                onChange={setFiltroSede}
                ariaLabel="Filtrar por sede"
                opciones={[{ value: 'TODAS', label: 'Todas las sedes' }, ...sedes.map((s) => ({ value: s.id, label: s.nombre }))]}
              />
            </div>
          )}
          <div className="select-field">
            <span className="field-label">TIPO</span>
            <Select
              value={filtroTipo}
              onChange={setFiltroTipo}
              ariaLabel="Filtrar por tipo"
              opciones={[{ value: 'TODOS', label: 'Todos los tipos' }, ...opcionesTipo.map(({ value, label }) => ({ value, label }))]}
            />
          </div>
        </div>

        {cargando ? (
          <LoadingState rows={3} label="Cargando canchas" />
        ) : error ? (
          <ErrorState title="No pudimos cargar las canchas" onRetry={() => setRecarga((n) => n + 1)} />
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title={canchas.length === 0 ? 'Todavía no hay canchas' : 'Ninguna cancha coincide con el filtro'}
            description={canchas.length === 0 ? 'Creá la primera cancha para poder recibir reservas.' : 'Probá con otra sede o tipo.'}
          />
        ) : (
          <>
            <SectionHeader title="Canchas" description={`${filtradas.length} en esta página`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {filtradas.map((c) => (
                <article key={c.id} className="glass" style={{ borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ aspectRatio: '16 / 7', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
                    {c.tipo.imagenUrl ? (
                      <img src={c.tipo.imagenUrl} alt={`Cancha de ${c.tipo.nombre}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ScanLine size={34} aria-hidden />
                    )}
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 14, color: 'var(--text)' }}>{c.nombre}</strong>
                        <p style={{ marginTop: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} aria-hidden /> {c.sede.nombre}
                        </p>
                      </div>
                      <Badge variant={c.estado === EstadoCancha.ACTIVA ? 'success' : 'warning'}>
                        {c.estado === EstadoCancha.ACTIVA ? 'Activa' : 'Mantenimiento'}
                      </Badge>
                    </div>
                    <p style={{ fontSize: 12 }}>
                      {c.tipo.nombre} · <strong style={{ color: 'var(--text)' }}>{formatMoney(Number(c.costoHoraBase))}/h</strong>
                    </p>
                    <div className="inline-actions" style={{ marginTop: 'auto' }}>
                      <button className="btn btn-secondary" onClick={() => abrirEditar(c)}>
                        <Pencil size={14} aria-hidden /> Editar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ color: 'var(--coral)' }}
                        onClick={() => {
                          setErrorEliminar('');
                          setAEliminar(c);
                        }}
                      >
                        <Trash2 size={14} aria-hidden /> Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      {formAbierto && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrarForm()}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar cancha' : 'Nueva cancha'} onSubmit={guardar}>
            <SectionHeader title={editingId ? 'Editar cancha' : 'Nueva cancha'} />
            <div className="stack-gap">
              <label>
                <span className="field-label">NOMBRE</span>
                <input className="field-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              {esGG ? (
                <div>
                  <span className="field-label">SEDE</span>
                  <Select
                    required
                    value={form.sedeId}
                    onChange={(v) => setForm({ ...form, sedeId: v })}
                    placeholder="Seleccionar sede..."
                    ariaLabel="Sede"
                    opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
                  />
                </div>
              ) : (
                <p style={{ fontSize: 12 }}>Se crea en tu sede.</p>
              )}
              <div>
                <span className="field-label">TIPO</span>
                <Select required value={form.tipoId} onChange={(v) => setForm({ ...form, tipoId: v })} placeholder="Seleccionar tipo..." ariaLabel="Tipo" opciones={opcionesTipo} />
              </div>
              <label>
                <span className="field-label">PRECIO POR HORA</span>
                <input
                  className="field-input"
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.costoHoraBase}
                  onChange={(e) => setForm({ ...form, costoHoraBase: e.target.value })}
                />
              </label>
              {editingId && (
                <div>
                  <span className="field-label">ESTADO</span>
                  <Select
                    value={form.estado}
                    onChange={(v) => setForm({ ...form, estado: v as Cancha['estado'] })}
                    ariaLabel="Estado"
                    opciones={[
                      { value: EstadoCancha.ACTIVA, label: 'Activa' },
                      { value: EstadoCancha.MANTENIMIENTO, label: 'Mantenimiento' },
                    ]}
                  />
                </div>
              )}
              {errorForm && (
                <p role="alert" className="notice notice-err">
                  {errorForm}
                </p>
              )}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cancha'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cerrarForm}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {aEliminar && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !eliminando && setAEliminar(null)}>
          <div className="glass panel modal-card" role="alertdialog" aria-modal="true" aria-label="Eliminar cancha">
            <SectionHeader title="Eliminar cancha" />
            <p style={{ marginBottom: 14, fontSize: 13 }}>
              ¿Eliminar <strong style={{ color: 'var(--text)' }}>{aEliminar.nombre}</strong> de {aEliminar.sede.nombre}? Solo se puede borrar si nunca tuvo reservas (cumplidas, canceladas o
              por cumplirse); si las tiene, ponela en mantenimiento: se respetan las reservas ya tomadas.
            </p>
            {errorEliminar && (
              <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>
                {errorEliminar}
              </p>
            )}
            <div className="inline-actions">
              <button className="btn btn-danger" disabled={eliminando} onClick={() => void confirmarEliminar()}>
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="btn btn-secondary" disabled={eliminando} onClick={() => setAEliminar(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
