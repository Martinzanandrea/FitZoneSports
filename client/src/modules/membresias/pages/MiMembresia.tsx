import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, Dumbbell, MapPin, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { membresiasApi } from '../membresias.api';
import type { EstadoSocio } from '../membresias.types';
import { TarjetaProxima } from '../components/TarjetaProxima';
import { preciosApi } from '../../precios/precios.api';
import type { PrecioPlan } from '../../precios/precios.types';
import { Badge } from '../../../shared/components/atoms';
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';
import {
  diasRestantes,
  duracionDias,
  fechaValidaHasta,
  formatearDDMMAAAA,
} from '../../../shared/utils/fechasMembresia';

const BENEFICIOS = [
  { icon: Dumbbell, titulo: 'Acceso libre todo el día', detalle: 'Según las franjas de tu sede, sin límites' },
  { icon: CalendarDays, titulo: 'Clases grupales incluidas', detalle: 'Reservalas desde la app' },
  { icon: MapPin, titulo: 'Todas las sedes', detalle: 'Entrená donde te quede cómodo' },
  { icon: Sparkles, titulo: 'Beneficios en canchas', detalle: 'Tarifas especiales para socios' },
];

const DESCRIPCIONES_PLAN: Record<string, string> = {
  MENSUAL: 'Flexibilidad total',
  TRIMESTRAL: 'Mejor equilibrio',
  ANUAL: 'Máximo beneficio',
};

function tonoMembresia(estado: EstadoSocio['estado']): 'success' | 'warning' | 'danger' {
  return estado === 'ACTIVO' ? 'success' : estado === 'SUSPENDIDO' ? 'warning' : 'danger';
}

function etiquetaMembresia(estado: EstadoSocio['estado']): string {
  return estado === 'ACTIVO' ? 'Activo' : estado === 'SUSPENDIDO' ? 'Suspendido' : 'Vencido';
}

export function MiMembresia() {
  useTitulo('Mi membresía');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membresia, setMembresia] = useState<EstadoSocio | null>(null);
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      membresiasApi.getVigente(user.id).catch(() => null),
      preciosApi.getMembresiasPublico().catch(() => [] as PrecioPlan[]),
    ])
      .then(([m, p]) => {
        setMembresia(m);
        setPrecios(p);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Tu membresía</h2>
          <p>Estado, vigencia y planes con precios reales.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState rows={3} label="Cargando membresía" />
      ) : error ? (
        <ErrorState
          title="No pudimos cargar tu membresía"
          description="Revisá tu conexión e intentá de nuevo en unos segundos."
          onRetry={() => window.location.reload()}
        />
      ) : !membresia ? (
        <EmptyState
          title="No tenés una membresía activa"
          description="Elegí un plan para empezar a entrenar hoy mismo."
          icon={Sparkles}
          action={
            <button className="btn btn-primary" onClick={() => navigate('/completar-membresia')}>
              Contratar membresía
            </button>
          }
        />
      ) : (
        <MembresiaDetalle membresia={membresia} />
      )}

      {!loading && !error && precios.length > 0 && (
        <section className="glass panel" style={{ marginTop: 14 }} aria-label="Precios de planes">
          <SectionHeader title="Planes y precios vigentes" description="Valores reales del mes en curso." />
          <div className="plan-grid">
            {precios.map((p) => (
              <article key={p.plan} className={`plan-card${membresia?.plan === p.plan ? ' featured' : ''}`}>
                {membresia?.plan === p.plan && <span className="recommended">PLAN ACTUAL</span>}
                <h3>{p.plan}</h3>
                <strong className="plan-price">
                  ${Number(p.precio).toLocaleString('es-AR')}
                  <small>/ {p.plan === 'MENSUAL' ? 'mes' : p.plan === 'TRIMESTRAL' ? 'trimestre' : 'año'}</small>
                </strong>
                <p>{DESCRIPCIONES_PLAN[p.plan] ?? ''}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function MembresiaDetalle({ membresia }: { membresia: EstadoSocio }) {
  const totalDias = Math.max(1, duracionDias(membresia.fechaInicio, membresia.fechaFin));
  const restantes = diasRestantes(membresia.fechaFin);
  const usados = Math.min(totalDias, Math.max(0, totalDias - restantes));
  const progreso = (usados / totalDias) * 100;
  const vencida = restantes <= 0;
  const porVencer = !vencida && restantes <= 15;
  const validaHasta = formatearDDMMAAAA(fechaValidaHasta(membresia.fechaFin));

  return (
    <div>
      <Link to="/completar-membresia?renovar=true" className="membership-card" aria-label={`Plan ${membresia.plan}, ${etiquetaMembresia(membresia.estado)}`}>
        <div className="membership-orb" aria-hidden />
        <div className="membership-top">
          <span>FITZONE</span>
          <Sparkles size={26} aria-hidden />
        </div>
        <div className="membership-plan">PLAN {membresia.plan}</div>
        <div className="membership-name">
          {formatearDDMMAAAA(membresia.fechaInicio)} → {validaHasta}
        </div>
        <div className="membership-bottom">
          <span>
            {usados} de {totalDias} días · Válida hasta {validaHasta} · {membresia.sedeAlta.nombre}
          </span>
          <Badge variant={tonoMembresia(membresia.estado)}>{etiquetaMembresia(membresia.estado)}</Badge>
        </div>
      </Link>

      {membresia.proxima && (
        <div style={{ marginTop: 14 }}>
          <TarjetaProxima proxima={membresia.proxima} />
        </div>
      )}

      <div className="glass panel" style={{ marginTop: 14 }}>
        <div className="stack-list">
          <div className="list-row">
            <div className="row-main">
              <strong>Vigencia</strong>
              <span>
                {Math.max(0, restantes)} días restantes de {totalDias}
              </span>
            </div>
            <span className="cell-value">{Math.round(progreso)}%</span>
          </div>
          <div className="list-row">
            <div className="row-main">
              <strong>Sede de alta</strong>
              <span>Donde contrataste tu plan</span>
            </div>
            <span className="cell-value">{membresia.sedeAlta.nombre}</span>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          {vencida || porVencer ? (
            <Link to="/completar-membresia?renovar=true" className="btn btn-primary" style={{ width: '100%' }}>
              Renovar membresía
            </Link>
          ) : (
            <Link to="/completar-membresia?renovar=true" className="btn btn-secondary" style={{ width: '100%' }}>
              Renovar anticipadamente
            </Link>
          )}
        </div>
      </div>

      <div className="glass panel" style={{ marginTop: 14 }}>
        <SectionHeader title="Lo que incluye tu plan" />
        <div className="stack-list">
          {BENEFICIOS.map((b) => (
            <div className="list-row" key={b.titulo}>
              <span className="row-icon" aria-hidden>
                <b.icon size={20} />
              </span>
              <div className="row-main">
                <strong>{b.titulo}</strong>
                <span>{b.detalle}</span>
              </div>
              <Check size={14} aria-hidden style={{ color: 'var(--lime)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
