import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, CalendarDays, Clock3, DollarSign, Search, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../canchas.api';
import type { Cancha, ReservaCancha } from '../canchas.types';
import { usuariosApi, type ClienteBuscado } from '../../usuarios/usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede, FranjaHoraria } from '../../sedes/sedes.types';
import { MetricCard } from '../../../shared/components/molecules';;
import { Select } from '../../../shared/components/atoms';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const MIN_BUSQUEDA = 3;

function formatFecha(d: Date) {
  return d.toISOString().split('T')[0];
}
function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function aMinutos(hora: string) {
  const [h = '0', m = '0'] = hora.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}
// Misma regla que el backend (pricing-calculator: 19:00 a 20:59 es pico).
// Solo se usa como indicador visual; el precio siempre lo calcula el backend.
function esHoraPico(hora: number) {
  return hora >= 19 && hora < 21;
}

const ETIQUETA_ESTRATEGIA: Record<string, string> = {
  ESTANDAR: 'Tarifa estándar',
  SOCIO_DESCUENTO: 'Descuento de socio aplicado',
  HORA_PICO: 'Recargo de hora pico aplicado',
  SOCIO_HORA_PICO: 'Descuento de socio + recargo de hora pico',
};

// Slots de 1h cubiertos por las franjas reales de la sede (no el rango fijo 8-22).
function slotsDeFranjas(franjas: FranjaHoraria[]): number[] {
  const set = new Set<number>();
  for (const f of franjas) {
    const ini = Math.floor(aMinutos(f.apertura) / 60);
    const fin = Math.ceil(aMinutos(f.cierre) / 60);
    for (let h = ini; h < fin; h++) {
      // Solo slots contenidos por completo dentro de alguna franja.
      if (franjas.some((g) => aMinutos(g.apertura) <= h * 60 && aMinutos(g.cierre) >= (h + 1) * 60)) {
        set.add(h);
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

function duracionHoras(r: ReservaCancha) {
  return Math.max(0, (aMinutos(r.horaFin) - aMinutos(r.horaInicio)) / 60);
}

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function GestionReservasCanchas() {
  useTitulo('Reservas de canchas');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  // La sede del Gerente de Sede y del Recepcionista va fija; solo el GG la elige.
  const sedeId = esGG ? searchParams.get('sedeId') ?? user?.sedeId ?? null : user?.sedeId ?? null;
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [sede, setSede] = useState<Sede | null>(null);
  const [franjas, setFranjas] = useState<FranjaHoraria[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [canchaId, setCanchaId] = useState('');
  const [fecha, setFecha] = useState<string>(formatFecha(new Date()));
  const [reservas, setReservas] = useState<ReservaCancha[]>([]);
  const [reservasHoy, setReservasHoy] = useState<ReservaCancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [slotSel, setSlotSel] = useState<number | null>(null);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ClienteBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [clienteSel, setClienteSel] = useState<ClienteBuscado | null>(null);
  const [cotizacion, setCotizacion] = useState<{ precioFinal: number; estrategia: string } | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorPanel, setErrorPanel] = useState('');

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);
  const hoy = fechas[0] ? formatFecha(fechas[0]) : fecha;

  const canchasDeSede = useMemo(() => {
    if (!sedeId) return [];
    return canchas.filter((c) => c.sede.id === sedeId && c.estado === 'ACTIVA');
  }, [canchas, sedeId]);

  const canchaSel = canchasDeSede.find((c) => c.id === canchaId) ?? null;
  const slots = useMemo(() => slotsDeFranjas(franjas), [franjas]);

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  useEffect(() => {
    if (!sedeId) {
      setLoading(false);
      return;
    }
    let viva = true;
    setLoading(true);
    setError(false);
    async function init() {
      try {
        const [canchasRes, sedeData, franjasData] = await Promise.all([
          canchasApi.getAll(1, 100),
          sedesApi.getOne(sedeId as string),
          sedesApi.getFranjas(sedeId as string).catch(() => [] as FranjaHoraria[]),
        ]);
        if (!viva) return;
        const allCanchas = canchasRes.data;
        setCanchas(allCanchas);
        setSede(sedeData);
        setFranjas(franjasData);
        const filtradas = allCanchas.filter((c) => c.sede.id === sedeId && c.estado === 'ACTIVA');
        setCanchaId(filtradas[0]?.id ?? '');
        setReservas([]);
      } catch {
        if (viva) setError(true);
      } finally {
        if (viva) setLoading(false);
      }
    }
    void init();
    return () => {
      viva = false;
    };
  }, [sedeId]);

  useEffect(() => {
    if (!canchaId) return;
    canchasApi.getReservasPorCancha(canchaId, fecha).then((res) => setReservas(res.data)).catch(() => setReservas([]));
  }, [canchaId, fecha, refreshKey]);

  // Stats del día (todas las canchas activas de la sede)
  useEffect(() => {
    if (!sedeId || canchasDeSede.length === 0) {
      setReservasHoy([]);
      return;
    }
    Promise.all(
      canchasDeSede.map((c) => canchasApi.getReservasPorCancha(c.id, hoy).then((r) => r.data).catch(() => [] as ReservaCancha[])),
    ).then((listas) => setReservasHoy(listas.flat().filter((r) => r.estado === 'CONFIRMADA')));
  }, [sedeId, canchasDeSede, refreshKey, hoy]);

  // Búsqueda de cliente en el panel: GET /usuarios/buscar-clientes (mínimo 3 caracteres).
  useEffect(() => {
    const q = busqueda.trim();
    if (slotSel === null || paso !== 1 || q.length < MIN_BUSQUEDA) {
      setResultados([]);
      setErrorBusqueda('');
      return;
    }
    let viva = true;
    setBuscando(true);
    const t = window.setTimeout(() => {
      usuariosApi
        .buscarClientes(q)
        .then((r) => {
          if (!viva) return;
          setResultados(r);
          setErrorBusqueda('');
        })
        .catch(() => viva && setErrorBusqueda('No se pudo buscar. Intentá de nuevo.'))
        .finally(() => viva && setBuscando(false));
    }, 300);
    return () => {
      viva = false;
      window.clearTimeout(t);
      setBuscando(false);
    };
  }, [busqueda, slotSel, paso]);

  useEffect(() => {
    if (slotSel === null) return;
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrarPanel();
    }
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [slotSel]);

  const stats = useMemo(() => {
    const horasOcupadas = reservasHoy.reduce((acc, r) => acc + duracionHoras(r), 0);
    const horasFranjas = franjas.reduce((acc, f) => acc + Math.max(0, (aMinutos(f.cierre) - aMinutos(f.apertura)) / 60), 0);
    const horasDisponibles = horasFranjas * canchasDeSede.length;
    const ingreso = reservasHoy.reduce((acc, r) => acc + Number(r.precioFinal), 0);
    return { count: reservasHoy.length, horasOcupadas, horasDisponibles, ingreso };
  }, [reservasHoy, franjas, canchasDeSede]);

  const pctOcupacion = stats.horasDisponibles > 0 ? Math.min(100, Math.round((stats.horasOcupadas / stats.horasDisponibles) * 100)) : 0;

  function reservaEnSlot(hora: number): ReservaCancha | null {
    const ini = hora * 60;
    const fin = (hora + 1) * 60;
    return reservas.find((r) => r.estado === 'CONFIRMADA' && aMinutos(r.horaInicio) < fin && aMinutos(r.horaFin) > ini) ?? null;
  }

  const esHoy = fecha === hoy;
  const ahoraMin = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);
  function slotPasado(hora: number) {
    return esHoy && (hora + 1) * 60 <= ahoraMin;
  }

  function abrirSlot(hora: number) {
    setSlotSel(hora);
    setPaso(1);
    setBusqueda('');
    setClienteSel(null);
    setCotizacion(null);
    setErrorPanel('');
  }
  function cerrarPanel() {
    setSlotSel(null);
    setPaso(1);
    setCotizacion(null);
    setErrorPanel('');
  }

  async function irAPaso2() {
    if (slotSel === null || !canchaId || !clienteSel) return;
    setCotizando(true);
    setErrorPanel('');
    setCotizacion(null);
    try {
      const cot = await canchasApi.cotizar({
        canchaId,
        usuarioId: clienteSel.id,
        fecha,
        horaInicio: `${String(slotSel).padStart(2, '0')}:00`,
        horaFin: `${String(slotSel + 1).padStart(2, '0')}:00`,
      });
      setCotizacion(cot);
      setPaso(2);
    } catch (e: unknown) {
      setErrorPanel(mensajeDe(e, 'No se pudo cotizar el turno.'));
    } finally {
      setCotizando(false);
    }
  }

  async function handleConfirmar() {
    if (slotSel === null || !canchaId || !clienteSel) return;
    setConfirmando(true);
    setErrorPanel('');
    try {
      await canchasApi.reservar({
        canchaId,
        usuarioId: clienteSel.id,
        fecha,
        horaInicio: `${String(slotSel).padStart(2, '0')}:00`,
        horaFin: `${String(slotSel + 1).padStart(2, '0')}:00`,
      });
      setMsg({ type: 'ok', text: 'Reserva confirmada.' });
      cerrarPanel();
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      setErrorPanel(mensajeDe(e, 'No se pudo confirmar la reserva.'));
    } finally {
      setConfirmando(false);
    }
  }

  async function handleCancelar(id: string) {
    setAccionId(id);
    try {
      await canchasApi.cancelar(id);
      setReservas((prev) => prev.filter((r) => r.id !== id));
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo cancelar.') });
    } finally {
      setAccionId(null);
    }
  }

  // Todos necesitan sede asignada para operar salvo el GG, que tiene sedeId
  // null por diseño ("todas las sedes") y elige la sede con el selector.
  if (!sedeId && !esGG) {
    return (
      <EmptyState
        icon={Building2}
        title="Todavía no tenés una sede asignada"
        description="Contactá a un gerente para que te asigne una sede."
      />
    );
  }

  const confirmadasDelDia = reservas.filter((r) => r.estado === 'CONFIRMADA');

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Reservas de canchas</h2>
          <p>{sede ? `${sede.nombre}. ` : ''}Reservá en nombre de un socio o cliente externo.</p>
        </div>
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      {esGG && (
        <div className="filters">
          <div className="select-field">
            <span className="field-label">SEDE</span>
            <Select
              value={sedeId ?? ''}
              onChange={(v) => setSearchParams(v ? { sedeId: v } : {})}
              opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              placeholder="Seleccionar sede..."
              ariaLabel="Sede"
            />
          </div>
        </div>
      )}

      {!sedeId ? (
        <EmptyState icon={Building2} title="Elegí una sede" description="Seleccioná una sede para gestionar sus reservas." />
      ) : loading ? (
        <LoadingState rows={4} label="Cargando canchas" />
      ) : error ? (
        <ErrorState title="No pudimos cargar las canchas" onRetry={() => window.location.reload()} />
      ) : (
        <>
          <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
            <MetricCard label="Reservas hoy" value={String(stats.count)} change="confirmadas" icon={CalendarDays} />
            <MetricCard
              label="Ocupación hoy"
              value={`${stats.horasOcupadas}/${stats.horasDisponibles}h`}
              change={`${pctOcupacion}% de las horas`}
              icon={Clock3}
            />
            <MetricCard label="Ingreso estimado hoy" value={`$${stats.ingreso.toLocaleString('es-AR')}`} change="reservas confirmadas" icon={DollarSign} />
          </div>

          <div className="segmented" role="tablist" aria-label="Fecha">
            {fechas.map((d, i) => {
              const f = formatFecha(d);
              const label = i === 0 ? 'Hoy' : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <button key={f} type="button" role="tab" aria-selected={fecha === f} className={fecha === f ? 'active' : ''} onClick={() => setFecha(f)}>
                  {label}
                </button>
              );
            })}
          </div>

          {canchasDeSede.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No hay canchas activas" description="Tu sede no tiene canchas activas para reservar." />
          ) : (
            <>
              <div className="segmented" role="tablist" aria-label="Cancha">
                {canchasDeSede.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={canchaId === c.id} className={canchaId === c.id ? 'active' : ''} onClick={() => setCanchaId(c.id)}>
                    {c.nombre} · {c.tipo.nombre}
                  </button>
                ))}
              </div>

              {slots.length === 0 ? (
                <EmptyState icon={Clock3} title="Sin franjas horarias" description="La sede no tiene franjas horarias cargadas." />
              ) : (
                <section className="glass panel" aria-label="Horarios">
                  <div className="stack-list">
                    {slots.map((h) => {
                      const hi = `${String(h).padStart(2, '0')}:00`;
                      const hf = `${String(h + 1).padStart(2, '0')}:00`;
                      const ocupante = reservaEnSlot(h);
                      const pico = esHoraPico(h);
                      const pasado = slotPasado(h);
                      return (
                        <div className="list-row" key={hi} style={pasado && !ocupante ? { opacity: 0.55 } : undefined}>
                          <div className="row-main">
                            <strong>
                              {hi} - {hf}
                            </strong>
                            <span>
                              {ocupante
                                ? `${ocupante.usuario.nombre} ${ocupante.usuario.apellido}`
                                : pasado
                                  ? 'Horario finalizado'
                                  : pico
                                    ? 'Horario pico: puede tener recargo'
                                    : 'Disponible'}
                            </span>
                          </div>
                          {ocupante ? (
                            <span className="badge badge-neutral">
                              <i />
                              Ocupado
                            </span>
                          ) : pasado ? (
                            <span className="badge badge-neutral">
                              <i />
                              Finalizado
                            </span>
                          ) : (
                            <>
                              {pico && (
                                <span className="badge badge-warning">
                                  <i />
                                  Pico 19-21
                                </span>
                              )}
                              <button className="btn btn-primary" onClick={() => abrirSlot(h)}>
                                Reservar
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {confirmadasDelDia.length > 0 && (
                <section className="glass panel" style={{ marginTop: 14 }} aria-label="Reservas del día">
                  <div className="section-header">
                    <div>
                      <h2>Reservas del {fecha}</h2>
                      <p>Podés cancelarlas desde acá.</p>
                    </div>
                  </div>
                  <div className="stack-list">
                    {confirmadasDelDia.map((r) => (
                      <div className="list-row" key={r.id}>
                        <div className="row-main">
                          <strong>
                            {r.horaInicio.slice(0, 5)} - {r.horaFin.slice(0, 5)} · {r.usuario.nombre} {r.usuario.apellido}
                          </strong>
                          <span>
                            ${r.precioFinal} · {r.estrategiaPrecio}
                          </span>
                        </div>
                        <button className="btn btn-secondary" onClick={() => void handleCancelar(r.id)} disabled={accionId === r.id}>
                          {accionId === r.id ? '...' : 'Cancelar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* Panel superpuesto: reserva en 2 pasos */}
      {slotSel !== null && canchaSel && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Reservar cancha" onClick={(e) => e.target === e.currentTarget && cerrarPanel()}>
          <div className="glass panel modal-card">
            <div className="section-header">
              <div>
                <h2>
                  {canchaSel.nombre} · {String(slotSel).padStart(2, '0')}:00 - {String(slotSel + 1).padStart(2, '0')}:00
                </h2>
                <p>
                  {fecha} · Paso {paso} de 2
                </p>
              </div>
              <button className="icon-button" aria-label="Cerrar" onClick={cerrarPanel}>
                <X size={18} />
              </button>
            </div>

            {errorPanel && (
              <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>
                {errorPanel}
              </p>
            )}

            {paso === 1 && (
              <div className="stack-gap">
                <span className="field-label">BUSCAR CLIENTE (SOCIO O EXTERNO)</span>
                <label className="search search-wide">
                  <Search size={15} aria-hidden />
                  <input
                    type="search"
                    autoFocus
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre, apellido o DNI (mínimo 3 letras)"
                    aria-label="Buscar cliente"
                  />
                </label>
                {buscando && <LoadingState rows={1} label="Buscando" />}
                {errorBusqueda && (
                  <p role="alert" className="notice notice-err">
                    {errorBusqueda}
                  </p>
                )}
                {!buscando && !errorBusqueda && busqueda.trim().length >= MIN_BUSQUEDA && resultados.length === 0 && (
                  <p style={{ fontSize: 12 }}>No encontramos clientes con esa búsqueda.</p>
                )}
                <div className="pick-list">
                  {resultados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`pick-item ${clienteSel?.id === u.id ? 'active' : ''}`}
                      aria-pressed={clienteSel?.id === u.id}
                      onClick={() => setClienteSel(u)}
                    >
                      <span>
                        {u.nombre} {u.apellido}
                        <br />
                        <small>DNI {u.dni ?? 'sin DNI'}</small>
                      </span>
                      <small>{u.tipoActor === TipoActor.EXTERNO ? 'Externo' : 'Socio'}</small>
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" disabled={!clienteSel || cotizando} onClick={() => void irAPaso2()}>
                  {cotizando ? 'Cotizando...' : 'Continuar'}
                </button>
              </div>
            )}

            {paso === 2 && clienteSel && (
              <div className="stack-gap">
                <div className="stack-list">
                  <div className="list-row">
                    <div className="row-main">
                      <strong>Cancha</strong>
                      <span>
                        {canchaSel.nombre} · {canchaSel.tipo.nombre}
                      </span>
                    </div>
                  </div>
                  <div className="list-row">
                    <div className="row-main">
                      <strong>Turno</strong>
                      <span>
                        {fecha} · {String(slotSel).padStart(2, '0')}:00 - {String(slotSel + 1).padStart(2, '0')}:00
                      </span>
                    </div>
                  </div>
                  <div className="list-row">
                    <div className="row-main">
                      <strong>Cliente</strong>
                      <span>
                        {clienteSel.nombre} {clienteSel.apellido} · {clienteSel.tipoActor === TipoActor.EXTERNO ? 'Externo' : 'Socio'}
                      </span>
                    </div>
                  </div>
                  {cotizacion && (
                    <div className="list-row">
                      <div className="row-main">
                        <strong>Total ${Number(cotizacion.precioFinal).toLocaleString('es-AR')}</strong>
                        <span>
                          Base ${Number(canchaSel.costoHoraBase).toLocaleString('es-AR')}/h · {ETIQUETA_ESTRATEGIA[cotizacion.estrategia] ?? cotizacion.estrategia}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="inline-actions">
                  <button className="btn btn-ghost" onClick={() => setPaso(1)}>
                    ← Atrás
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!cotizacion || confirmando} onClick={() => void handleConfirmar()}>
                    {confirmando ? 'Confirmando...' : 'Confirmar reserva'}
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
