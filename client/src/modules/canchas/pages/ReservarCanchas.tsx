import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Volleyball } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../canchas.api';
import type { Cancha, MiReservaCancha, ReservaCancha } from '../canchas.types';
import { Badge } from '../../../shared/components/atoms';
import { Select } from '../../../shared/components/atoms';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';
import {
  motivoDeError,
  TEXTO_REQUIERE_CONEXION,
  useAlVolverConexion,
  useEstadoConexion,
} from '../../../shared/hooks/useEstadoConexion';

const HORAS = Array.from({ length: 15 }, (_, i) => 8 + i); // 8..22

function formatFecha(d: Date) {
  return d.toISOString().split('T')[0];
}
function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function fechaLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ReservarCanchas() {
  useTitulo('Reservar canchas');
  const { user } = useAuth();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [sedeFiltro, setSedeFiltro] = useState<string>('');
  const [tipoSel, setTipoSel] = useState<string>('');
  const [canchaId, setCanchaId] = useState<string>('');
  const [fecha, setFecha] = useState<string>(formatFecha(new Date()));
  // Franjas ocupadas (sin datos de quién reservó) y mis reservas del día,
  // ambas desde endpoints que no exponen reservas ajenas.
  const [ocupacion, setOcupacion] = useState<Array<{ horaInicio: string; horaFin: string }>>([]);
  const [misReservasDia, setMisReservasDia] = useState<MiReservaCancha[]>([]);
  const [recarga, setRecarga] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [errorDia, setErrorDia] = useState(false);
  const [intentoCanchas, setIntentoCanchas] = useState(0);
  const online = useEstadoConexion();
  const [reservando, setReservando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ultimaReserva, setUltimaReserva] = useState<ReservaCancha | null>(null);
  const [cotizacion, setCotizacion] = useState<{ horaInicio: string; horaFin: string; precioFinal: number; estrategia: string } | null>(null);

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  const sedes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of canchas) mapa.set(c.sede.id, c.sede.nombre);
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [canchas]);

  const tipos = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const c of canchas) {
      if (!vistos.has(c.tipoId)) vistos.set(c.tipoId, c.tipo.nombre);
    }
    return Array.from(vistos.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [canchas]);

  const canchasFiltradas = useMemo(
    () =>
      canchas.filter(
        (c) =>
          (sedeFiltro === '' || c.sede.id === sedeFiltro) &&
          (tipoSel === '' || c.tipoId === tipoSel),
      ),
    [canchas, sedeFiltro, tipoSel],
  );

  useEffect(() => {
    let viva = true;
    canchasApi
      .getAll(1, 100)
      .then((res) => {
        if (!viva) return;
        setCanchas(res.data);
        if (res.data.length) setCanchaId(res.data[0].id);
        setErrorCarga(false);
        setLoading(false);
      })
      .catch(() => {
        if (!viva) return;
        setErrorCarga(true);
        setLoading(false);
      });
    return () => {
      viva = false;
    };
  }, [intentoCanchas]);

  const reintentarCanchas = useCallback(() => {
    setLoading(true);
    setIntentoCanchas((n) => n + 1);
  }, []);

  useAlVolverConexion(() => {
    if (errorCarga) reintentarCanchas();
    else if (errorDia) setRecarga((n) => n + 1);
  });

  useEffect(() => {
    if (tipos.length > 0 && (tipoSel === '' || !tipos.some((t) => t.id === tipoSel))) setTipoSel(tipos[0].id);
  }, [tipos, tipoSel]);

  useEffect(() => {
    if (canchaId && !canchasFiltradas.some((c) => c.id === canchaId) && canchasFiltradas.length > 0) {
      setCanchaId(canchasFiltradas[0].id);
    }
  }, [canchasFiltradas, canchaId]);

  useEffect(() => {
    if (!canchaId) return;
    let viva = true;
    Promise.all([canchasApi.getOcupacion(canchaId, fecha), canchasApi.getMisReservas({ fecha })])
      .then(([ocup, mias]) => {
        if (!viva) return;
        setOcupacion(ocup);
        setMisReservasDia(mias.data);
        setErrorDia(false);
      })
      // Si falla, no se sabe qué horarios están ocupados: no se muestran como
      // libres, se bloquea la grilla y se ofrece reintentar.
      .catch(() => {
        if (!viva) return;
        setOcupacion([]);
        setMisReservasDia([]);
        setErrorDia(true);
      });
    return () => {
      viva = false;
    };
  }, [canchaId, fecha, recarga]);

  const ocupadas = useMemo(
    () => new Set(ocupacion.map((r) => r.horaInicio.slice(0, 5))),
    [ocupacion],
  );

  async function confirmarReserva() {
    if (!user || !canchaId || !cotizacion) return;
    const { horaInicio, horaFin } = cotizacion;
    setReservando(horaInicio);
    setMsg(null);
    try {
      const r = await canchasApi.reservar({ canchaId, usuarioId: user.id, fecha, horaInicio, horaFin });
      setUltimaReserva(r);
      setMsg({ type: 'ok', text: `Reserva confirmada — $${r.precioFinal} (${r.estrategiaPrecio})` });
      setRecarga((n) => n + 1);
      setCotizacion(null);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo reservar.' });
    } finally {
      setReservando(null);
    }
  }

  async function handleReservar(hora: number) {
    if (!user || !canchaId) return;
    const horaInicio = `${String(hora).padStart(2, '0')}:00`;
    const horaFin = `${String(hora + 1).padStart(2, '0')}:00`;
    setReservando(horaInicio);
    setMsg(null);
    setUltimaReserva(null);
    try {
      const quote = await canchasApi.cotizar({ canchaId, usuarioId: user.id, fecha, horaInicio, horaFin });
      setCotizacion({ horaInicio, horaFin, ...quote });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo reservar.' });
    } finally {
      setReservando(null);
    }
  }

  const hoy = formatFecha(new Date());
  const horaActual = new Date().getHours();

  async function handleCancelar(id: string) {
    setReservando(id);
    try {
      await canchasApi.cancelar(id);
      setRecarga((n) => n + 1);
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo cancelar.' });
    } finally {
      setReservando(null);
    }
  }

  if (loading) return <LoadingState rows={4} label="Cargando canchas" />;
  if (errorCarga)
    return (
      <ErrorState
        title="No pudimos cargar las canchas"
        description={motivoDeError()}
        retryLabel="Reintentar"
        onRetry={reintentarCanchas}
      />
    );

  const canchaSel = canchasFiltradas.find((c) => c.id === canchaId);
  const misReservasHoy = misReservasDia.filter((r) => r.cancha.id === canchaId);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Reservar cancha</h2>
          <p>Elegí sede, deporte y horario. El precio lo calcula el backend.</p>
        </div>
      </div>

      {msg && (
        <p
          role="status"
          style={{
            borderRadius: 12,
            border: `1px solid ${msg.type === 'ok' ? 'rgba(140,242,166,.3)' : 'rgba(255,130,108,.3)'}`,
            background: msg.type === 'ok' ? 'rgba(140,242,166,.08)' : 'rgba(255,130,108,.08)',
            padding: '12px 16px',
            fontSize: 12,
            marginBottom: 13,
          }}
        >
          {msg.text}
        </p>
      )}

      <div className="booking-layout">
        <section className="glass booking-main" aria-label="Elegí tu turno">
          <div className="filters glass" style={{ marginBottom: 18, padding: 12 }}>
            <div className="select-field">
              <span>SEDE</span>
              <Select
                value={sedeFiltro}
                onChange={setSedeFiltro}
                ariaLabel="Filtrar por sede"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
                placeholder="Todas las sedes"
              />
            </div>
            <div className="select-field">
              <span>DEPORTE</span>
              <Select
                value={tipoSel}
                onChange={setTipoSel}
                ariaLabel="Filtrar por deporte"
                opciones={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
                placeholder="Todos los deportes"
              />
            </div>
          </div>

          <div className="segmented" role="tablist" aria-label="Deporte">
            {tipos.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tipoSel === t.id}
                className={tipoSel === t.id ? 'active' : ''}
                onClick={() => setTipoSel(t.id)}
              >
                {t.nombre}
              </button>
            ))}
          </div>

          <div className="date-strip" role="tablist" aria-label="Día">
            {fechas.map((d, i) => {
              const f = fechaLocalYMD(d);
              const activo = fecha === f;
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={activo}
                  className={activo ? 'active' : ''}
                  onClick={() => setFecha(f)}
                >
                  <span>{i === 0 ? 'hoy' : d.toLocaleDateString('es-AR', { weekday: 'short' })}</span>
                  <strong>{d.getDate()}</strong>
                </button>
              );
            })}
          </div>

          <h3>Cancha</h3>
          <div className="stack-list" style={{ marginBottom: 18 }}>
            {canchasFiltradas.length === 0 ? (
              <EmptyState
                title="No hay canchas para estos filtros"
                description="Probá cambiando de sede o deporte."
                icon={Volleyball}
              />
            ) : (
              canchasFiltradas.map((c) => (
                <button
                  key={c.id}
                  className={`plan-option${canchaId === c.id ? ' active' : ''}`}
                  onClick={() => setCanchaId(c.id)}
                  aria-pressed={canchaId === c.id}
                >
                  <span>
                    <strong>{c.nombre}</strong>
                    <small>
                      {c.tipo.nombre} · {c.sede.nombre}
                    </small>
                  </span>
                  <span className="price">${c.costoHoraBase}/h</span>
                </button>
              ))
            )}
          </div>

          <h3>Horarios disponibles</h3>
          {errorDia && (
            <div role="alert" style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, marginBottom: 10 }}>
                No se pudieron cargar los horarios. {motivoDeError()}.
              </p>
              <button className="btn btn-secondary" onClick={() => setRecarga((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          )}
          {!online && (
            <p role="status" style={{ fontSize: 11, marginBottom: 12 }}>
              {TEXTO_REQUIERE_CONEXION} Reservar y cancelar se habilita al reconectarte.
            </p>
          )}
          <div className="time-grid">
            {HORAS.map((h) => {
              const hi = `${String(h).padStart(2, '0')}:00`;
              const ocupado = ocupadas.has(hi);
              const vencido = fecha === hoy && h <= horaActual;
              const libre = !ocupado && !vencido;
              return (
                <button
                  key={hi}
                  disabled={!libre || errorDia || !online || reservando !== null}
                  onClick={() => void handleReservar(h)}
                  aria-label={libre ? `Reservar ${hi}` : ocupado ? `Ocupado ${hi}` : `Vencido ${hi}`}
                >
                  {hi.slice(0, 5)}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="glass booking-summary" aria-label="Tu reserva">
          <span className="eyebrow">TU RESERVA</span>
          <div className="summary-icon">
            <Volleyball size={26} aria-hidden />
          </div>
          <h2>{canchaSel?.nombre ?? 'Elegí una cancha'}</h2>
          <p>
            {canchaSel ? `${canchaSel.tipo.nombre} · ${canchaSel.sede.nombre}` : 'Selecciona una cancha para ver el resumen.'}
          </p>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>{fecha}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>{cotizacion ? `${cotizacion.horaInicio.slice(0, 5)} - ${cotizacion.horaFin.slice(0, 5)}` : '—'}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{cotizacion ? `$${cotizacion.precioFinal}` : '—'}</dd>
            </div>
          </dl>
          <button
            className="btn btn-primary"
            disabled={!cotizacion || !online || reservando !== null}
            onClick={() => void confirmarReserva()}
          >
            {reservando ? 'Reservando...' : 'Confirmar reserva'} <ArrowRight size={17} aria-hidden />
          </button>
          <small style={{ fontSize: 9, color: 'var(--muted)', marginTop: 10 }}>
            Cancelación sin cargo hasta 6 h antes.
          </small>
        </aside>
      </div>

      {ultimaReserva && (
        <div className="glass panel" style={{ marginTop: 14 }}>
          <SectionHeader title="Última reserva" description="Confirmada y lista para jugar." />
          <div className="stack-list">
            <div className="list-row">
              <div className="row-main">
                <strong>
                  {ultimaReserva.fecha} · {ultimaReserva.horaInicio.slice(0, 5)} - {ultimaReserva.horaFin.slice(0, 5)}
                </strong>
                <span>${ultimaReserva.precioFinal}</span>
              </div>
              <Badge variant="info">{ultimaReserva.estrategiaPrecio}</Badge>
            </div>
          </div>
        </div>
      )}

      {misReservasHoy.length > 0 && (
        <div className="glass panel" style={{ marginTop: 14 }}>
          <SectionHeader title={`Mis reservas para ${fecha}`} description="Cancelá sin cargo hasta 6 h antes." />
          <div className="stack-list">
            {misReservasHoy.map((r) => (
              <div className="list-row" key={r.id}>
                <div className="row-main">
                  <strong>
                    {r.horaInicio.slice(0, 5)} - {r.horaFin.slice(0, 5)}
                  </strong>
                  <span>
                    ${r.precioFinal} · {r.estrategiaPrecio}
                  </span>
                </div>
                <button className="btn btn-secondary" onClick={() => void handleCancelar(r.id)} disabled={reservando === r.id || !online}>
                  {reservando === r.id ? '...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
