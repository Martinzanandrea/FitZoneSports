import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Banknote, Volleyball } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../../canchas/canchas.api';
import { EstadoCancha, type Cancha } from '../../canchas/canchas.types';
import { pagosApi } from '../pagos.api';
import type { Pago } from '../pagos.types';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { BotonComprobante } from './BotonComprobante';

// Misma grilla que la reserva online: turnos de una hora, de 08:00 a 22:00.
const HORAS = Array.from({ length: 15 }, (_, i) => 8 + i);

function fechaLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

interface Props {
  clienteId: string;
  onCobrado: () => void;
}

// Cobro presencial: el cliente llega al mostrador, elige cancha y horario y
// paga en el acto. El precio lo calcula el servidor; acá solo se muestra.
export function CobroCanchaMostrador({ clienteId, onCobrado }: Props) {
  const { user } = useAuth();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [canchaId, setCanchaId] = useState('');
  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  }), []);
  const [fecha, setFecha] = useState(() => fechaLocalYMD(new Date()));
  const [ocupacion, setOcupacion] = useState<Array<{ horaInicio: string }>>([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [hora, setHora] = useState<number | null>(null);
  const [cotizacion, setCotizacion] = useState<{ precioFinal: number; estrategia: string } | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);

  // Solo canchas de la sede de quien cobra y que no estén en mantenimiento
  // (el servidor igual rechaza cualquier otra).
  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    canchasApi
      .getAll(1, 100)
      .then((res) => {
        if (!viva) return;
        const propias = res.data.filter((c) => c.sede.id === user?.sedeId && c.estado === EstadoCancha.ACTIVA);
        setCanchas(propias);
        setCanchaId((actual) => (propias.some((c) => c.id === actual) ? actual : propias[0]?.id ?? ''));
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [user?.sedeId, recarga]);

  useEffect(() => {
    if (!canchaId) return;
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargandoTurnos(true);
    setHora(null);
    setCotizacion(null);
    canchasApi
      .getOcupacion(canchaId, fecha)
      .then((o) => viva && setOcupacion(o))
      .catch(() => viva && setOcupacion([]))
      .finally(() => viva && setCargandoTurnos(false));
    return () => {
      viva = false;
    };
  }, [canchaId, fecha, recarga]);

  const ocupadas = useMemo(() => new Set(ocupacion.map((o) => o.horaInicio.slice(0, 5))), [ocupacion]);
  const hoy = fechaLocalYMD(new Date());
  const horaActual = new Date().getHours();
  const canchaSel = canchas.find((c) => c.id === canchaId);

  const turno = (h: number) => ({
    horaInicio: `${String(h).padStart(2, '0')}:00`,
    horaFin: `${String(h + 1).padStart(2, '0')}:00`,
  });

  async function elegirHora(h: number) {
    setHora(h);
    setCotizacion(null);
    setMsg(null);
    setPago(null);
    setCotizando(true);
    try {
      const q = await canchasApi.cotizar({ canchaId, usuarioId: clienteId, fecha, ...turno(h) });
      setCotizacion(q);
    } catch (e) {
      setHora(null);
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo calcular el precio.') });
    } finally {
      setCotizando(false);
    }
  }

  async function confirmar() {
    if (hora === null) return;
    setConfirmando(true);
    setMsg(null);
    try {
      const res = await pagosApi.cobrarCanchaPresencial({ usuarioId: clienteId, canchaId, fecha, ...turno(hora) });
      setPago(res);
      setMsg({ type: 'ok', text: `Cobro registrado: $${Number(res.monto).toLocaleString('es-AR')} — turno reservado.` });
      setHora(null);
      setCotizacion(null);
      setRecarga((n) => n + 1);
      onCobrado();
    } catch (e) {
      // Horario ocupado, cancha en mantenimiento, etc.: se refresca la grilla.
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo registrar el cobro.') });
      setHora(null);
      setCotizacion(null);
      setRecarga((n) => n + 1);
    } finally {
      setConfirmando(false);
    }
  }

  if (cargando) return <LoadingState rows={2} label="Cargando canchas de la sede" />;
  if (error) return <ErrorState title="No pudimos cargar las canchas" onRetry={() => setRecarga((n) => n + 1)} />;
  if (canchas.length === 0) {
    return (
      <EmptyState
        icon={Volleyball}
        title="Tu sede no tiene canchas disponibles"
        description="Las canchas en mantenimiento no se pueden cobrar."
      />
    );
  }

  return (
    <div className="stack-gap">
      <div>
        <span className="field-label">CANCHA</span>
        <div className="stack-list">
          {canchas.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`plan-option${canchaId === c.id ? ' active' : ''}`}
              aria-pressed={canchaId === c.id}
              onClick={() => {
                setCanchaId(c.id);
                setMsg(null);
              }}
            >
              <span>
                <strong>{c.nombre}</strong>
                <small>{c.tipo.nombre}</small>
              </span>
              <span className="price">${Number(c.costoHoraBase).toLocaleString('es-AR')}/h</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="field-label">DÍA</span>
        <div className="date-strip" role="tablist" aria-label="Día">
          {fechas.map((d, i) => {
            const f = fechaLocalYMD(d);
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={fecha === f}
                className={fecha === f ? 'active' : ''}
                onClick={() => {
                  setFecha(f);
                  setMsg(null);
                }}
              >
                <span>{i === 0 ? 'hoy' : d.toLocaleDateString('es-AR', { weekday: 'short' })}</span>
                <strong>{d.getDate()}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="field-label">HORARIOS DISPONIBLES</span>
        {cargandoTurnos ? (
          <LoadingState rows={1} label="Cargando horarios" />
        ) : (
          <div className="time-grid">
            {HORAS.map((h) => {
              const { horaInicio } = turno(h);
              const ocupado = ocupadas.has(horaInicio);
              const vencido = fecha === hoy && h <= horaActual;
              const libre = !ocupado && !vencido;
              return (
                <button
                  key={horaInicio}
                  type="button"
                  className={hora === h ? 'active' : ''}
                  aria-pressed={hora === h}
                  disabled={!libre || cotizando || confirmando}
                  aria-label={libre ? `Elegir ${horaInicio}` : ocupado ? `No disponible ${horaInicio}` : `Vencido ${horaInicio}`}
                  onClick={() => void elegirHora(h)}
                >
                  {horaInicio}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {cotizando && <LoadingState rows={1} label="Calculando precio" />}
      {cotizacion && hora !== null && canchaSel && (
        <div className="notice" role="status">
          <strong>
            {canchaSel.nombre} · {fecha} · {turno(hora).horaInicio} - {turno(hora).horaFin}
          </strong>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Precio a cobrar: <strong>${cotizacion.precioFinal.toLocaleString('es-AR')}</strong>
          </p>
        </div>
      )}

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`}>
          {msg.text}
        </p>
      )}

      <button type="button" className="btn btn-primary" disabled={!cotizacion || confirmando} onClick={() => void confirmar()}>
        <Banknote size={16} aria-hidden />
        {confirmando
          ? 'Registrando...'
          : cotizacion
            ? `Cobrar $${cotizacion.precioFinal.toLocaleString('es-AR')} y reservar`
            : 'Elegí un horario'}
      </button>

      {pago?.comprobante?.id && (
        <div className="notice notice-ok">
          <strong>Comprobante generado</strong>
          <div className="inline-actions" style={{ marginTop: 10 }}>
            <BotonComprobante comprobanteId={pago.comprobante.id} className="btn btn-secondary" />
            <Link className="btn btn-ghost" to="/admin/pagos" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
              Ver en Pagos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
