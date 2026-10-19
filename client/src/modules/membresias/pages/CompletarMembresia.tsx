import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CreditCard } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import { membresiasApi } from '../membresias.api';
import type { EstadoSocio } from '../membresias.types';
import { pagosApi } from '../../pagos/pagos.api';
import { preciosApi } from '../../precios/precios.api';
import type { Sede } from '../../sedes/sedes.types';
import type { TipoPlan } from '../membresias.types';
import type { PrecioPlan } from '../../precios/precios.types';
import { formatMoney } from '../../../shared/utils/formatMoney';
import { Select } from '../../../shared/components/atoms';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { AuthLayout } from '../../auth/AuthLayout';
import { TipoActor } from '../../../shared/types/enums';
import { invalidarUnaVez } from '../../../shared/utils/unaVez';
import {
  diasRestantes,
  fechaValidaHasta,
  formatearDDMMAAAA,
} from '../../../shared/utils/fechasMembresia';

const DESCRIPCIONES: Record<string, string> = {
  MENSUAL: 'Ideal para empezar',
  TRIMESTRAL: 'Ahorrás un 8%',
  ANUAL: 'Ahorrás un 20%',
};

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function CompletarMembresia() {
  useTitulo('Completá tu membresía');
  const { user, refrescarUsuario } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esRenovacion = searchParams.get('renovar') === 'true';
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [sedeId, setSedeId] = useState('');
  const [plan, setPlan] = useState<TipoPlan>('MENSUAL');
  const [metodo, setMetodo] = useState<'MERCADOPAGO' | 'MODO'>('MERCADOPAGO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simularRechazo, setSimularRechazo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [estado, setEstado] = useState<EstadoSocio | null>(null);
  // Guard contra doble envío: evita un segundo pago antes de que el estado
  // (loading/deshabilitado) se vuelva a renderizar.
  const enviando = useRef(false);
  const esExterno = user?.tipoActor === TipoActor.EXTERNO;
  const usuarioId = user?.id;
  const [cargandoEstado, setCargandoEstado] = useState(!esExterno);

  useEffect(() => {
    if (!usuarioId || esExterno) return;
    let viva = true;
    membresiasApi
      .getVigente(usuarioId)
      .then((m) => viva && setEstado(m))
      .catch(() => viva && setEstado(null))
      .finally(() => viva && setCargandoEstado(false));
    return () => {
      viva = false;
    };
  }, [usuarioId, esExterno]);

  useEffect(() => {
    Promise.all([
      sedesApi.getAllPublico().catch(() => [] as Sede[]),
      preciosApi.getMembresiasPublico().catch(() => [] as PrecioPlan[]),
    ])
      .then(([s, p]) => {
        setSedes(s);
        setPrecios(p);
      })
      .catch(() => setErrorCarga(true))
      .finally(() => setCargando(false));
  }, []);

  // Reemplaza al array PLANES hardcodeado: ahora sale de precios_plan
  // (backend), editable por el Gerente sin tocar código.
  const planes = precios.map((p) => ({
    value: p.plan,
    label: p.plan.charAt(0) + p.plan.slice(1).toLowerCase(),
    precio: Number(p.precio),
    descripcion: DESCRIPCIONES[p.plan] ?? '',
  }));

  const planSeleccionado = planes.find((p) => p.value === plan);
  const proxima = estado?.proxima ?? null;
  const bloqueado = proxima !== null;
  const vigente =
    estado && estado.estado === 'ACTIVO' && diasRestantes(estado.fechaFin) > 0
      ? estado
      : null;
  const avisoVigente = vigente
    ? `Tu plan vigente vale hasta el ${formatearDDMMAAAA(fechaValidaHasta(vigente.fechaFin))}. El nuevo comienza el ${formatearDDMMAAAA(vigente.fechaFin)} y no perdés ningún día pagado.`
    : '';

  async function handleConfirmar() {
    if (enviando.current || bloqueado) return;
    if (!user || !sedeId) {
      setError('Elegí una sede para continuar.');
      return;
    }
    enviando.current = true;
    setLoading(true);
    setError('');
    try {
      // La membresía no existe antes del pago: el backend la crea (o renueva)
      // junto con el pago aprobado, en una sola operación. Un rechazo no deja
      // nada creado, así que no hay nada que cancelar.
      const pago = await pagosApi.pagarConPasarela({
        usuarioId: user.id,
        plan,
        sedeAltaId: sedeId,
        metodo,
        simularRechazo,
        // Sin "monto": el backend recalcula el precio real desde
        // precios_plan, ignorando cualquier valor que mandemos acá.
      });
      if (pago.estado !== 'APROBADO') {
        setError('El pago fue rechazado. Podés reintentar con otro método.');
        return;
      }
      // Pago aprobado: el backend ya promovió al Externo a Socio. Se descarta
      // cualquier carga previa de `vigente` y se vuelve a pedir /auth/me para
      // que el panel muestre la vista de Socio sin cerrar sesión.
      invalidarUnaVez(`vigente:${user.id}`);
      await refrescarUsuario().catch(() => undefined);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      // El 409 (membresía ya programada) llega con el mensaje del servidor.
      setError(mensajeDe(err, 'No se pudo completar el pago. Intentá de nuevo.'));
    } finally {
      setLoading(false);
      enviando.current = false;
    }
  }

  if (cargando || cargandoEstado)
    return (
      <AuthLayout>
        <LoadingState rows={3} label="Cargando planes" />
      </AuthLayout>
    );
  if (errorCarga)
    return (
      <AuthLayout>
        <ErrorState
          title="No pudimos cargar los planes"
          description="Revisá tu conexión e intentá de nuevo en unos segundos."
          onRetry={() => window.location.reload()}
        />
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <span className="eyebrow">{esRenovacion ? 'RENOVACIÓN' : esExterno ? 'HACETE SOCIO' : 'ÚLTIMO PASO'}</span>
      <h1>{esRenovacion ? 'Renovar tu membresía' : '¡Ya casi! Elegí tu plan'}</h1>
      <p>Para activar tu membresía necesitamos que elijas un plan y una sede.</p>
      {esExterno && planSeleccionado && (
        <p style={{ marginTop: 8 }}>
          Al pagar el plan {planSeleccionado.label} ({formatMoney(planSeleccionado.precio)}) pasás a ser socio.
        </p>
      )}

      {bloqueado && proxima && (
        <p role="alert" className="notice notice-err" style={{ marginTop: 12 }}>
          Ya tenés una membresía programada para el {formatearDDMMAAAA(proxima.fechaInicio)}.
        </p>
      )}
      {!bloqueado && avisoVigente && (
        <p role="status" className="notice notice-ok" style={{ marginTop: 12 }}>
          {avisoVigente}
        </p>
      )}

      <div>
        {planes.length === 0 ? (
          <EmptyState
            title="No hay planes disponibles"
            description="Los precios de los planes no se pudieron cargar. Intentá más tarde."
            icon={CreditCard}
          />
        ) : (
          <div className="stack-list" style={{ marginBottom: 18 }}>
            {planes.map((p) => (
              <button
                key={p.value}
                className={`plan-option${plan === p.value ? ' active' : ''}`}
                onClick={() => setPlan(p.value as TipoPlan)}
                aria-pressed={plan === p.value}
              >
                <span>
                  <strong>{p.label}</strong>
                  <small>{p.descripcion}</small>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="price">${p.precio.toLocaleString('es-AR')}</span>
                  {plan === p.value && <Check size={16} aria-hidden style={{ color: 'var(--lime)' }} />}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <span className="field-label">SEDE DONDE TE VAS A REGISTRAR</span>
          <Select
            value={sedeId}
            onChange={setSedeId}
            opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
            placeholder="Seleccionar sede…"
          />
          <p style={{ fontSize: 10, marginTop: 8 }}>Recordá que tu abono te da acceso a todas las sedes por igual.</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <span className="field-label">MÉTODO DE PAGO</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['MERCADOPAGO', 'MODO'] as const).map((m) => (
              <button
                key={m}
                className={`plan-option${metodo === m ? ' active' : ''}`}
                onClick={() => setMetodo(m)}
                aria-pressed={metodo === m}
                style={{ justifyContent: 'center' }}
              >
                <CreditCard size={16} aria-hidden />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{m === 'MERCADOPAGO' ? 'Mercado Pago' : 'Modo'}</span>
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, marginTop: 10, color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={simularRechazo}
              onChange={(e) => setSimularRechazo(e.target.checked)}
            />
            Simular pago rechazado (solo testing)
          </label>
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 12, marginBottom: 14, color: 'var(--coral)' }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => void handleConfirmar()}
          disabled={loading || bloqueado || !planSeleccionado || !sedeId}
        >
          {loading
            ? 'Procesando pago…'
            : bloqueado
              ? 'Membresía ya programada'
              : `Pagar $${(planSeleccionado?.precio ?? 0).toLocaleString('es-AR')}`}
        </button>
      </div>
    </AuthLayout>
  );
}
