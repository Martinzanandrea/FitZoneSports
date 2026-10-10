import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Receipt, RefreshCw, Search, Smartphone } from 'lucide-react';
import { pagosApi } from '../pagos.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import type {
  FiltrosHistorialPagos,
  MetodoHistorial,
  PagoHistorial,
  TipoHistorial,
  TotalesHistorial,
} from '../pagos.types';
import { TipoActor } from '../../../shared/types/enums';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Badge, Pagination, formatMoney } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { MetricCard } from '../../../shared/components/MetricCard';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { BotonComprobante } from '../components/BotonComprobante';

// Los filtros no se achican por debajo de esto: pasan a la línea siguiente.
const CAMPO = { flexGrow: 1, minWidth: 140 } as const;
const MIN_BUSQUEDA = 3;
const ZONA = 'America/Argentina/Buenos_Aires';

const ETIQUETA_ESTADO = { APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', PENDIENTE: 'Pendiente' } as const;
const VARIANTE_ESTADO = { APROBADO: 'success', RECHAZADO: 'danger', PENDIENTE: 'warning' } as const;
const NOMBRE_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  MERCADOPAGO: 'Mercado Pago',
  MODO: 'Modo',
};

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function HistorialPagos() {
  useTitulo('Pagos');
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;

  const [filas, setFilas] = useState<PagoHistorial[]>([]);
  const [totales, setTotales] = useState<TotalesHistorial | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metodo, setMetodo] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');

  // Comprobantes emitidos desde esta pantalla (se muestran sin recargar).
  const [emitidos, setEmitidos] = useState<Record<string, string>>({});
  const [emitiendo, setEmitiendo] = useState<string | null>(null);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState<string | null>(null);
  const [regenerados, setRegenerados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  // La búsqueda se manda recién con 3 caracteres o más, y con una pausa al tipear.
  useEffect(() => {
    const texto = busqueda.trim();
    const t = window.setTimeout(() => {
      setQ(texto.length >= MIN_BUSQUEDA ? texto : '');
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    const filtros: FiltrosHistorialPagos = {
      page,
      desde: desde || undefined,
      hasta: hasta || undefined,
      metodo: (metodo as MetodoHistorial) || undefined,
      tipo: (tipo as TipoHistorial) || undefined,
      estado: (estado as FiltrosHistorialPagos['estado']) || undefined,
      q: q || undefined,
      sedeId: esGG && sedeId ? sedeId : undefined,
    };
    pagosApi
      .getHistorial(filtros)
      .then((res) => {
        if (!viva) return;
        setFilas(res.data);
        setTotales(res.totales);
        setTotalPages(res.totalPages);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, desde, hasta, metodo, tipo, estado, q, sedeId, esGG, recarga]);

  function cambiar<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  async function emitir(pagoId: string) {
    setEmitiendo(pagoId);
    setErrorEmision(null);
    try {
      const c = await pagosApi.generarComprobante(pagoId);
      setEmitidos((prev) => ({ ...prev, [pagoId]: c.id }));
    } catch {
      setErrorEmision(pagoId);
    } finally {
      setEmitiendo(null);
    }
  }

  async function regenerar(pagoId: string) {
    setRegenerando(pagoId);
    setErrorEmision(null);
    try {
      await pagosApi.regenerarComprobante(pagoId);
      setRegenerados((prev) => new Set(prev).add(pagoId));
    } catch {
      setErrorEmision(pagoId);
    } finally {
      setRegenerando(null);
    }
  }

  const hayFiltros = Boolean(desde || hasta || metodo || tipo || estado || q || sedeId);
  const cols = esGG ? '1.1fr 1.5fr 1.6fr 1fr 0.9fr 0.9fr 0.8fr 1.9fr' : '1.1fr 1.6fr 1.6fr 1fr 0.9fr 0.9fr 1.9fr';

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Pagos</h2>
          <p>{esGG ? 'Historial de pagos de toda la red.' : 'Historial de pagos de tu sede.'}</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard
          label="Pagos"
          value={totales ? String(totales.cantidad) : '—'}
          change={hayFiltros ? 'con los filtros aplicados' : 'en total'}
          icon={Receipt}
        />
        <MetricCard
          label="Cobrado (aprobados)"
          value={totales ? formatMoney(Number(totales.montoAprobado)) : '—'}
          change="suma de pagos aprobados"
          icon={CreditCard}
        />
        <MetricCard
          label="En efectivo"
          value={totales ? formatMoney(Number(totales.montoEfectivo)) : '—'}
          change="cobrado en mostrador"
          icon={Banknote}
        />
        <MetricCard
          label="Online"
          value={totales ? formatMoney(Number(totales.montoOnline)) : '—'}
          change="Mercado Pago y Modo"
          icon={Smartphone}
        />
      </div>

      <section className="glass panel" aria-label="Historial de pagos">
        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14, flexWrap: 'wrap' }}>
          {esGG && (
            <div className="select-field" style={CAMPO}>
              <span className="field-label">SEDE</span>
              <Select
                value={sedeId}
                onChange={cambiar(setSedeId)}
                placeholder="Todas las sedes"
                ariaLabel="Filtrar por sede"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          )}
          <label className="select-field" style={CAMPO}>
            <span className="field-label">DESDE</span>
            <input className="field-input" type="date" value={desde} max={hasta || undefined} onChange={(e) => cambiar(setDesde)(e.target.value)} />
          </label>
          <label className="select-field" style={CAMPO}>
            <span className="field-label">HASTA</span>
            <input className="field-input" type="date" value={hasta} min={desde || undefined} onChange={(e) => cambiar(setHasta)(e.target.value)} />
          </label>
          <div className="select-field" style={CAMPO}>
            <span className="field-label">MÉTODO</span>
            <Select
              value={metodo}
              onChange={cambiar(setMetodo)}
              placeholder="Todos"
              ariaLabel="Filtrar por método"
              opciones={[
                { value: 'EFECTIVO', label: 'Efectivo' },
                { value: 'ONLINE', label: 'Online' },
              ]}
            />
          </div>
          <div className="select-field" style={CAMPO}>
            <span className="field-label">TIPO</span>
            <Select
              value={tipo}
              onChange={cambiar(setTipo)}
              placeholder="Todos"
              ariaLabel="Filtrar por tipo"
              opciones={[
                { value: 'MEMBRESIA', label: 'Membresía' },
                { value: 'CANCHA', label: 'Cancha' },
              ]}
            />
          </div>
          <div className="select-field" style={CAMPO}>
            <span className="field-label">ESTADO</span>
            <Select
              value={estado}
              onChange={cambiar(setEstado)}
              placeholder="Todos"
              ariaLabel="Filtrar por estado"
              opciones={[
                { value: 'APROBADO', label: 'Aprobado' },
                { value: 'RECHAZADO', label: 'Rechazado' },
                { value: 'PENDIENTE', label: 'Pendiente' },
              ]}
            />
          </div>
          <div className="select-field" style={{ flexGrow: 2, minWidth: 240 }}>
            <span className="field-label">BUSCAR</span>
            <label className="search search-wide">
              <Search size={15} aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o DNI (mín. 3 letras)..."
                aria-label="Buscar por nombre o DNI"
              />
            </label>
          </div>
        </div>

        {cargando ? (
          <LoadingState rows={5} label="Cargando pagos" />
        ) : error ? (
          <ErrorState
            title="No pudimos cargar los pagos"
            description="Revisá tu conexión e intentá de nuevo en unos segundos."
            onRetry={() => setRecarga((n) => n + 1)}
          />
        ) : filas.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hayFiltros ? 'Ningún pago coincide' : 'Todavía no hay pagos'}
            description={hayFiltros ? 'Probá con otras fechas, método o búsqueda.' : 'Cuando se cobre una membresía o una cancha aparece acá.'}
          />
        ) : (
          <div className="ops-table" style={{ ['--cols' as string]: cols }}>
            <div className="ops-row ops-head">
              <span>FECHA</span>
              <span>CLIENTE</span>
              <span>CONCEPTO</span>
              <span>MÉTODO</span>
              <span>MONTO</span>
              <span>ESTADO</span>
              {esGG && <span>SEDE</span>}
              <span>COMPROBANTE</span>
            </div>
            {filas.map((p) => {
              const nombre = `${p.cliente.nombre} ${p.cliente.apellido}`;
              const comprobanteId = emitidos[p.id] ?? p.comprobanteId;
              return (
                <div className="ops-row" key={p.id}>
                  <span data-label="FECHA">{fechaHora(p.fecha)}</span>
                  <div className="person-cell">
                    <Avatar name={nombre} size={34} />
                    <span>
                      <strong>{nombre}</strong>
                    </span>
                  </div>
                  <span data-label="CONCEPTO">{p.concepto}</span>
                  <span data-label="MÉTODO">
                    {NOMBRE_METODO[p.metodo] ?? p.metodo}
                    {p.cobradoPor && (
                      <>
                        <br />
                        <small>Cobró {p.cobradoPor}</small>
                      </>
                    )}
                  </span>
                  <span data-label="MONTO" className="ops-strong">
                    {formatMoney(Number(p.monto))}
                  </span>
                  <span>
                    <Badge variant={VARIANTE_ESTADO[p.estado]}>{ETIQUETA_ESTADO[p.estado]}</Badge>
                  </span>
                  {esGG && <span data-label="SEDE">{p.sede?.nombre ?? '—'}</span>}
                  <span>
                    {comprobanteId ? (
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <BotonComprobante comprobanteId={comprobanteId} ariaLabel={`Ver comprobante del pago de ${nombre}`} />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ minHeight: 44, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: 'var(--muted)' }}
                          disabled={regenerando === p.id}
                          onClick={() => void regenerar(p.id)}
                          aria-label={`Regenerar comprobante del pago de ${nombre}`}
                        >
                          <RefreshCw size={14} aria-hidden />
                          {regenerando === p.id ? 'Regenerando…' : 'Regenerar comprobante'}
                        </button>
                        {regenerados.has(p.id) && (
                          <span role="status" style={{ fontSize: 11, color: 'var(--aqua)' }}>
                            Comprobante actualizado.
                          </span>
                        )}
                        {errorEmision === p.id && (
                          <span role="alert" style={{ color: 'var(--coral)', fontSize: 11 }}>
                            No se pudo regenerar.
                          </span>
                        )}
                      </span>
                    ) : p.estado === 'APROBADO' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ minHeight: 44, padding: '0 10px' }}
                          disabled={emitiendo === p.id}
                          onClick={() => void emitir(p.id)}
                          aria-label={`Generar comprobante del pago de ${nombre}`}
                        >
                          {emitiendo === p.id ? 'Generando…' : 'Generar'}
                        </button>
                        {errorEmision === p.id && (
                          <span role="alert" style={{ color: 'var(--coral)', fontSize: 11 }}>
                            No se pudo generar.
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </>
  );
}
