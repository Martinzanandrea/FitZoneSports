import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarDays, Plus, Search, Users, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../clases.types';
import { usuariosApi, type ClienteBuscado } from '../../usuarios/usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { Select } from '../../../shared/components/atoms';;
import { MetricCard } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const DIAS_A_FUTURO = 14;
const MIN_BUSQUEDA = 3;

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

// Acento de cada tipo de clase con los tokens de la paleta (determinístico por nombre).
const ACENTOS = ['var(--lime)', 'var(--aqua)', 'var(--coral)'];
function acentoPorTipo(tipoClase: string): string {
  let hash = 0;
  for (let i = 0; i < tipoClase.length; i++) hash = (hash * 31 + tipoClase.charCodeAt(i)) >>> 0;
  return ACENTOS[hash % ACENTOS.length];
}

function aYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatearFecha(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

function etiquetaDia(fechaYMD: string): string {
  const fecha = new Date(`${fechaYMD}T00:00:00`);
  const dia = fecha.toLocaleDateString('es-AR', { weekday: 'long' });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${formatearFecha(fechaYMD)}`;
}

function inicioOcurrencia(o: ClaseOcurrencia): number {
  return new Date(`${o.fecha}T${o.horaInicio}`).getTime();
}

function etiquetaOcurrencia(o: ClaseOcurrencia): string {
  return `${formatearFecha(o.fecha)} · ${o.horaInicio.slice(0, 5)} - ${o.horaFin.slice(0, 5)}`;
}

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function GestionReservasClases() {
  useTitulo('Reservas de clases');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  // La sede del Gerente de Sede y del Recepcionista va fija; solo el GG la elige.
  const sedeId = esGG ? searchParams.get('sedeId') ?? user?.sedeId ?? null : user?.sedeId ?? null;

  const [sedeNombre, setSedeNombre] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [reservasPorOcurrencia, setReservasPorOcurrencia] = useState<Record<string, ReservaClase[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const [diaSel, setDiaSel] = useState(() => new Date().getDay());
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [paso, setPaso] = useState(1);
  const [occSelId, setOccSelId] = useState('');
  const [socioElegido, setSocioElegido] = useState<ClienteBuscado | null>(null);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [resultados, setResultados] = useState<ClienteBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  const clasesDeSede = useMemo(() => {
    if (!sedeId) return [];
    return clases.filter((c) => c.sede.id === sedeId && c.activa);
  }, [clases, sedeId]);

  const clasePorId = useMemo(() => new Map(clases.map((c) => [c.id, c])), [clases]);

  // Ocurrencias de la sede para tabs/stats/panel.
  const ocurrenciasDeSede = useMemo(() => {
    const todas = Object.entries(ocurrenciasPorClase)
      .filter(([claseId]) => clasesDeSede.some((c) => c.id === claseId))
      .flatMap(([claseId, occs]) => occs.map((o) => ({ ...o, claseId })));
    return todas.filter((o) => o.estado === 'PROGRAMADA').sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
  }, [ocurrenciasPorClase, clasesDeSede]);

  const conteoPorDia = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const o of ocurrenciasDeSede) {
      const dia = new Date(`${o.fecha}T00:00`).getDay();
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
    }
    return mapa;
  }, [ocurrenciasDeSede]);

  const ocurrenciasDelDia = useMemo(
    () => ocurrenciasDeSede.filter((o) => new Date(`${o.fecha}T00:00`).getDay() === diaSel),
    [ocurrenciasDeSede, diaSel],
  );

  const statsHoy = useMemo(() => {
    const hoy = aYMD(new Date());
    const deHoy = ocurrenciasDeSede.filter((o) => o.fecha === hoy);
    let ocupadas = 0;
    let capacidad = 0;
    let casiLlenas = 0;
    for (const o of deHoy) {
      const cap = clasePorId.get(o.claseId)?.capacidad ?? 0;
      const oc = (reservasPorOcurrencia[o.id] ?? []).filter((r) => r.estado === 'RESERVADA').length;
      ocupadas += oc;
      capacidad += cap;
      if (cap > 0 && oc / cap >= 0.8) casiLlenas++;
    }
    return { clasesHoy: deHoy.length, ocupadas, capacidad, casiLlenas };
  }, [ocurrenciasDeSede, reservasPorOcurrencia, clasePorId]);

  // Se puede anotar hasta 30 minutos antes del inicio.
  const anotables = useMemo(() => {
    const limite = Date.now() + 30 * 60 * 1000;
    return ocurrenciasDeSede.filter((o) => inicioOcurrencia(o) >= limite);
  }, [ocurrenciasDeSede]);

  const anotablesPorDia = useMemo(() => {
    const grupos = new Map<string, ClaseOcurrencia[]>();
    for (const ocurrencia of anotables) {
      const grupo = grupos.get(ocurrencia.fecha) ?? [];
      grupo.push(ocurrencia);
      grupos.set(ocurrencia.fecha, grupo);
    }
    return Array.from(grupos.entries());
  }, [anotables]);

  const occElegida = useMemo(() => anotables.find((o) => o.id === occSelId) ?? null, [anotables, occSelId]);

  async function cargar() {
    setLoading(true);
    setError(false);
    try {
      const [clasesRes, sede] = await Promise.all([
        clasesApi.getAll(sedeId ?? undefined, 1, 100),
        sedeId ? sedesApi.getOne(sedeId).catch(() => null) : Promise.resolve(null),
      ]);
      const allClases = clasesRes.data;
      setClases(allClases);
      if (sede) setSedeNombre(sede.nombre);
      const deSede = allClases.filter((c) => c.activa && sedeId !== null && c.sede.id === sedeId);
      const hoy = aYMD(new Date());
      const hasta = aYMD(new Date(Date.now() + DIAS_A_FUTURO * 24 * 60 * 60 * 1000));
      const occMap: Record<string, ClaseOcurrencia[]> = {};
      await Promise.all(
        deSede.map(async (c) => {
          try {
            occMap[c.id] = (await clasesApi.getOcurrencias(c.id, hoy, hasta, 1, 100)).data;
          } catch {
            occMap[c.id] = [];
          }
        }),
      );
      setOcurrenciasPorClase(occMap);
      const resMap: Record<string, ReservaClase[]> = {};
      await Promise.all(
        Object.values(occMap)
          .flat()
          .map(async (o) => {
            try {
              resMap[o.id] = (await clasesApi.getReservasPorOcurrencia(o.id)).data;
            } catch {
              resMap[o.id] = [];
            }
          }),
      );
      setReservasPorOcurrencia(resMap);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  // Búsqueda de socio en el panel: GET /usuarios/buscar-clientes (mínimo 3 caracteres).
  useEffect(() => {
    const q = busquedaUsuario.trim();
    if (!panelAbierto || paso !== 2 || q.length < MIN_BUSQUEDA) {
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
  }, [busquedaUsuario, panelAbierto, paso]);

  useEffect(() => {
    if (!panelAbierto) return;
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanelAbierto(false);
    }
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [panelAbierto]);

  function abrirPanel() {
    setPaso(1);
    setOccSelId('');
    setSocioElegido(null);
    setBusquedaUsuario('');
    setMsg(null);
    setPanelAbierto(true);
  }

  function ocupadasDe(ocurrenciaId: string) {
    return (reservasPorOcurrencia[ocurrenciaId] ?? []).filter((r) => r.estado === 'RESERVADA').length;
  }

  async function handleConfirmar() {
    if (!occSelId || !socioElegido) return;
    setAccionId('anotar');
    setMsg(null);
    try {
      const reserva = await clasesApi.reservar(occSelId, socioElegido.id);
      setReservasPorOcurrencia((prev) => ({ ...prev, [occSelId]: [...(prev[occSelId] ?? []), reserva] }));
      setPanelAbierto(false);
      setMsg({ type: 'ok', text: `Reserva creada: ${reserva.usuario.nombre} ${reserva.usuario.apellido} — ${reserva.estado}` });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo reservar.') });
    } finally {
      setAccionId(null);
    }
  }

  async function handleCancelar(reservaId: string) {
    setAccionId(reservaId);
    setMsg(null);
    try {
      await clasesApi.cancelarReserva(reservaId);
      setReservasPorOcurrencia((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = next[k].filter((r) => r.id !== reservaId);
        return next;
      });
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
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

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Reservas de clases</h2>
          <p>{sedeNombre || 'Tu sede'}</p>
        </div>
        {sedeId && !loading && !error && (
          <button className="btn btn-primary" onClick={abrirPanel}>
            <Plus size={16} aria-hidden /> Anotar socio
          </button>
        )}
      </div>

      {esGG && (
        <div className="filters">
          <div className="select-field">
            <span className="field-label">SEDE</span>
            <Select
              value={sedeId ?? ''}
              onChange={(v) => setSearchParams(v ? { sedeId: v } : {})}
              opciones={sedes.map((sede) => ({ value: sede.id, label: sede.nombre }))}
              placeholder="Seleccionar sede..."
              ariaLabel="Sede"
            />
          </div>
        </div>
      )}

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      {!sedeId ? (
        <EmptyState icon={Building2} title="Elegí una sede" description="Seleccioná una sede para gestionar sus reservas." />
      ) : loading ? (
        <LoadingState rows={4} label="Cargando clases" />
      ) : error ? (
        <ErrorState title="No pudimos cargar las clases" onRetry={() => void cargar()} />
      ) : (
        <>
          <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
            <MetricCard label="Clases hoy" value={String(statsHoy.clasesHoy)} change="programadas" icon={CalendarDays} />
            <MetricCard label="Cupo ocupado hoy" value={`${statsHoy.ocupadas}/${statsHoy.capacidad}`} change="lugares reservados" icon={Users} />
            <MetricCard label="Casi llenas" value={String(statsHoy.casiLlenas)} change="más del 80% de cupo" icon={AlertTriangle} />
          </div>

          <div className="segmented" role="tablist" aria-label="Día de la semana">
            {DIAS_SEMANA.map((d) => (
              <button
                key={d.value}
                type="button"
                role="tab"
                aria-selected={diaSel === d.value}
                className={diaSel === d.value ? 'active' : ''}
                onClick={() => setDiaSel(d.value)}
              >
                {d.label} ({conteoPorDia.get(d.value) ?? 0})
              </button>
            ))}
          </div>

          {ocurrenciasDelDia.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Sin clases este día" description="No hay clases programadas para este día en los próximos 14 días." />
          ) : (
            <div className="stack-gap">
              {ocurrenciasDelDia.map((o) => {
                const clase = clasePorId.get(o.claseId);
                if (!clase) return null;
                const ocupadas = ocupadasDe(o.id);
                const llena = ocupadas >= clase.capacidad;
                const expandida = expandidas[o.id] ?? false;
                const reservas = reservasPorOcurrencia[o.id] ?? [];
                return (
                  <article key={o.id} className="glass panel" style={{ borderLeft: `4px solid ${acentoPorTipo(clase.tipoClase)}` }}>
                    <div className="section-header" style={{ marginBottom: 6 }}>
                      <div>
                        <h2>{clase.tipoClase}</h2>
                        <p>
                          {formatearFecha(o.fecha)} · {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)} · {clase.instructor.nombre}
                        </p>
                      </div>
                      <span className={`badge ${llena ? 'badge-warning' : 'badge-success'}`}>
                        <i />
                        {llena ? 'Llena' : `${ocupadas}/${clase.capacidad}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-expanded={expandida}
                      onClick={() => setExpandidas((prev) => ({ ...prev, [o.id]: !expandida }))}
                    >
                      {expandida ? 'Ocultar reservas' : `Ver reservas (${reservas.length})`}
                    </button>
                    {expandida && (
                      <div className="stack-list" style={{ marginTop: 6 }}>
                        {reservas.length === 0 ? (
                          <p style={{ fontSize: 12 }}>Sin reservas.</p>
                        ) : (
                          reservas.map((r) => (
                            <div className="list-row" key={r.id}>
                              <div className="row-main">
                                <strong>
                                  {r.usuario.nombre} {r.usuario.apellido}
                                </strong>
                                <span>
                                  {r.estado === 'LISTA_ESPERA' ? 'En espera: entra solo si alguien cancela su lugar' : ' '}
                                </span>
                              </div>
                              <span
                                className={`badge ${
                                  r.estado === 'RESERVADA' ? 'badge-success' : r.estado === 'LISTA_ESPERA' ? 'badge-warning' : r.estado === 'CANCELADA' ? 'badge-neutral' : 'badge-info'
                                }`}
                              >
                                <i />
                                {r.estado}
                              </span>
                              {r.estado !== 'CANCELADA' && (
                                <button className="btn btn-secondary" onClick={() => void handleCancelar(r.id)} disabled={accionId === r.id}>
                                  {accionId === r.id ? '...' : 'Cancelar'}
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {panelAbierto && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Anotar socio"
          onClick={(e) => e.target === e.currentTarget && setPanelAbierto(false)}
        >
          <div className="glass panel modal-card">
            <div className="section-header">
              <div>
                <h2>{paso === 1 ? 'Elegir clase' : paso === 2 ? 'Buscar socio' : 'Confirmar anotación'}</h2>
                <p>Paso {paso} de 3</p>
              </div>
              <button className="icon-button" aria-label="Cerrar" onClick={() => setPanelAbierto(false)}>
                <X size={18} />
              </button>
            </div>

            {paso === 1 &&
              (anotables.length === 0 ? (
                <p style={{ fontSize: 12 }}>No hay fechas disponibles para anotar.</p>
              ) : (
                <div className="stack-gap">
                  {anotablesPorDia.map(([fecha, ocurrencias]) => (
                    <section key={fecha} aria-label={etiquetaDia(fecha)}>
                      <span className="field-label">{etiquetaDia(fecha).toUpperCase()}</span>
                      <div className="pick-list" style={{ maxHeight: 'none' }}>
                        {ocurrencias.map((o) => {
                          const clase = clasePorId.get(o.claseId);
                          if (!clase) return null;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              className="pick-item"
                              onClick={() => {
                                setOccSelId(o.id);
                                setPaso(2);
                              }}
                            >
                              <span>
                                {clase.tipoClase}
                                <br />
                                <small>
                                  {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)}
                                </small>
                              </span>
                              <small>
                                Cupo {ocupadasDe(o.id)}/{clase.capacidad}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ))}

            {paso === 2 && (
              <div className="stack-gap">
                <label className="search search-wide">
                  <Search size={15} aria-hidden />
                  <input
                    type="search"
                    autoFocus
                    value={busquedaUsuario}
                    onChange={(e) => setBusquedaUsuario(e.target.value)}
                    placeholder="Nombre, apellido o DNI (mínimo 3 letras)"
                    aria-label="Buscar socio"
                  />
                </label>
                {buscando && <LoadingState rows={1} label="Buscando" />}
                {errorBusqueda && (
                  <p role="alert" className="notice notice-err">
                    {errorBusqueda}
                  </p>
                )}
                {!buscando && !errorBusqueda && busquedaUsuario.trim().length >= MIN_BUSQUEDA && resultados.length === 0 && (
                  <p style={{ fontSize: 12 }}>No encontramos clientes con esa búsqueda.</p>
                )}
                <div className="pick-list">
                  {resultados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="pick-item"
                      onClick={() => {
                        setSocioElegido(u);
                        setPaso(3);
                      }}
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
                <button className="btn btn-ghost" onClick={() => setPaso(1)}>
                  ← Volver
                </button>
              </div>
            )}

            {paso === 3 && occElegida && socioElegido && (
              <div className="stack-gap">
                <div className="list-row" style={{ borderTop: 0 }}>
                  <div className="row-main">
                    <strong>{clasePorId.get(occElegida.claseId)?.tipoClase}</strong>
                    <span>{etiquetaOcurrencia(occElegida)}</span>
                    <span style={{ color: 'var(--text)' }}>
                      {socioElegido.nombre} {socioElegido.apellido}
                      {socioElegido.dni ? ` · DNI ${socioElegido.dni}` : ''}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 11 }}>Se validará que el socio tenga membresía activa antes de confirmar.</p>
                <div className="inline-actions">
                  <button className="btn btn-ghost" onClick={() => setPaso(2)}>
                    ← Volver
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void handleConfirmar()} disabled={accionId === 'anotar'}>
                    {accionId === 'anotar' ? 'Anotando...' : 'Confirmar anotación'}
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
