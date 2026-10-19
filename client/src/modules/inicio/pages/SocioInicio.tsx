import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  QrCode,
  Volleyball,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { membresiasApi } from '../../membresias/membresias.api';
import type { EstadoSocio } from '../../membresias/membresias.types';
import { TarjetaProxima } from '../../membresias/components/TarjetaProxima';
import {
  fechaValidaHasta,
  formatearDDMMAAAA,
} from '../../../shared/utils/fechasMembresia';
import { Badge } from '../../../shared/components/atoms';
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { IconButton } from '../../../shared/components/atoms';;
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { unaVez } from '../../../shared/utils/unaVez';
import { formatearFechaCorta, useProximasReservas, type ProximaReserva } from '../hooks/useProximasReservas';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function tonoMembresia(estado: EstadoSocio['estado']): 'success' | 'warning' | 'danger' {
  return estado === 'ACTIVO' ? 'success' : estado === 'SUSPENDIDO' ? 'warning' : 'danger';
}

function etiquetaMembresia(estado: EstadoSocio['estado']): string {
  return estado === 'ACTIVO' ? 'Activo' : estado === 'SUSPENDIDO' ? 'Suspendido' : 'Vencido';
}

function TarjetaMembresia({ membresia, nombre }: { membresia: EstadoSocio; nombre: string }) {
  const validaHasta = formatearDDMMAAAA(fechaValidaHasta(membresia.fechaFin));
  return (
    <Link to="/membresia" className="membership-card" aria-label={`Mi membresía: plan ${membresia.plan}, ${etiquetaMembresia(membresia.estado)}`}>
      <div className="membership-orb" aria-hidden />
      <div className="membership-top">
        <span>FITZONE</span>
        <Dumbbell size={26} aria-hidden />
      </div>
      <div className="membership-plan">PLAN {membresia.plan}</div>
      <div className="membership-name">{nombre}</div>
      <div className="membership-bottom">
        <span>
          Válida hasta {validaHasta} · {membresia.sedeAlta.nombre}
        </span>
        <Badge variant={tonoMembresia(membresia.estado)}>{etiquetaMembresia(membresia.estado)}</Badge>
      </div>
    </Link>
  );
}

function TarjetaQr() {
  const navigate = useNavigate();
  return (
    <article className="qr-card">
      <div>
        <span className="eyebrow">INGRESO RÁPIDO</span>
        <h2>Tu pase de hoy</h2>
        <p>Mostralo en recepción para ingresar.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <span
          aria-hidden
          style={{
            width: 92,
            height: 92,
            borderRadius: 10,
            background: '#f3f6eb',
            display: 'grid',
            placeItems: 'center',
            color: '#071a1d',
          }}
        >
          <QrCode size={56} />
        </span>
      </div>
      <button className="btn btn-secondary" onClick={() => navigate('/mi-qr')}>
        Ver QR grande
      </button>
    </article>
  );
}

function ProximaActividad({ reserva }: { reserva: ProximaReserva }) {
  const [y, m, d] = reserva.fecha.split('-').map(Number);
  return (
    <article className="next-card">
      <span className="eyebrow">PRÓXIMA ACTIVIDAD</span>
      <div className="date-block">
        <strong>{String(d).padStart(2, '0')}</strong>
        <span>
          {MESES[m - 1]} {y}
          <br />
          {reserva.hora}
        </span>
      </div>
      <h2>{reserva.titulo}</h2>
      <p>{reserva.detalle}</p>
      {reserva.instructor && (
        <div className="avatar-line">
          <span aria-hidden>{reserva.instructor.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
          <div>
            <strong>{reserva.instructor}</strong>
            <small>Instructor</small>
          </div>
        </div>
      )}
    </article>
  );
}

function ListaProximas({ proximas }: { proximas: ProximaReserva[] }) {
  const navigate = useNavigate();
  return (
    <div className="stack-list">
      {proximas.map((item) => (
        <div className="list-row" key={`${item.kind}-${item.id}`}>
          <span className="row-icon" aria-hidden>
            {item.kind === 'clase' ? <Dumbbell size={20} /> : <Volleyball size={20} />}
          </span>
          <div className="row-main">
            <strong>{item.titulo}</strong>
            <span>
              {formatearFechaCorta(item.fecha)} · {item.hora} · {item.detalle}
            </span>
          </div>
          <Badge variant="info">{item.kind === 'clase' ? 'Clase' : 'Cancha'}</Badge>
          <IconButton
            icon={ChevronRight}
            label={`Ver ${item.titulo}`}
            onClick={() => navigate(item.to)}
          />
        </div>
      ))}
    </div>
  );
}

export function SocioInicio() {
  useTitulo('Mi panel');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membresia, setMembresia] = useState<EstadoSocio | null>(null);
  const [cargandoMembresia, setCargandoMembresia] = useState(true);
  const [errorMembresia, setErrorMembresia] = useState(false);
  const { proximas, cargando, error } = useProximasReservas(user?.id, 4);

  const usuarioId = user?.id;
  useEffect(() => {
    if (!usuarioId) return;
    let viva = true;
    unaVez(`vigente:${usuarioId}`, () => membresiasApi.getVigente(usuarioId))
      .then((m) => viva && setMembresia(m))
      .catch(() => viva && setErrorMembresia(true))
      .finally(() => viva && setCargandoMembresia(false));
    return () => {
      viva = false;
    };
  }, [usuarioId]);

  const nombreCompleto = `${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim().toUpperCase();

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Hola, {user?.nombre}</h2>
          <p>Tu actividad, membresía y próximas reservas.</p>
        </div>
      </div>

      <div className="hero-grid">
        {cargandoMembresia ? (
          <div className="glass skeleton-row rounded-[26px] p-6" role="status" aria-label="Cargando membresía">
            <i />
            <div>
              <i />
              <i />
            </div>
          </div>
        ) : errorMembresia ? (
          <div className="glass panel">
            <p style={{ fontSize: 12 }}>No pudimos cargar tu membresía.</p>
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
              Volver a intentar
            </button>
          </div>
        ) : membresia ? (
          <TarjetaMembresia membresia={membresia} nombre={nombreCompleto} />
        ) : (
          <article className="glass panel">
            <SectionHeader title="Todavía no tenés membresía" description="Elegí un plan para empezar a entrenar." />
            <button className="btn btn-primary" onClick={() => navigate('/completar-membresia')}>
              Elegir un plan
            </button>
          </article>
        )}
        <TarjetaQr />
        {cargando ? (
          <div className="glass skeleton-row rounded-[24px] p-6" role="status" aria-label="Cargando próxima actividad">
            <i />
            <div>
              <i />
              <i />
            </div>
          </div>
        ) : proximas.length > 0 ? (
          <ProximaActividad reserva={proximas[0]} />
        ) : (
          <article className="next-card">
            <span className="eyebrow">PRÓXIMA ACTIVIDAD</span>
            <h2 style={{ marginTop: 12 }}>Sin turnos agendados</h2>
            <p>Reservá una clase o cancha para verla acá.</p>
          </article>
        )}
      </div>

      {membresia?.proxima && (
        <div style={{ marginTop: 14 }}>
          <TarjetaProxima proxima={membresia.proxima} />
        </div>
      )}

      <div className="content-grid">
        <section className="glass panel" aria-label="Próximas reservas">
          <SectionHeader
            title="Próximas reservas"
            description="Todo lo que tenés agendado."
            action={
              <button className="btn btn-ghost" onClick={() => navigate('/reservar-clases')}>
                Ver todas
              </button>
            }
          />
          {cargando ? (
            <LoadingState rows={3} label="Cargando reservas" />
          ) : error ? (
            <ErrorState
              title="No pudimos cargar tus reservas"
              description={
                error === 'red'
                  ? 'Revisá tu conexión e intentá de nuevo en unos segundos.'
                  : 'Ocurrió un problema al mostrar tus reservas. Intentá de nuevo más tarde.'
              }
              onRetry={() => window.location.reload()}
            />
          ) : proximas.length === 0 ? (
            <EmptyState
              title="Sin reservas próximas"
              description="Reservá una clase o cancha para verlas acá."
              icon={CalendarDays}
              action={
                <button className="btn btn-secondary" onClick={() => navigate('/reservar-clases')}>
                  Reservar clase
                </button>
              }
            />
          ) : (
            <ListaProximas proximas={proximas} />
          )}
        </section>

        <section className="glass panel quick-panel" aria-label="Accesos rápidos">
          <SectionHeader title="¿Qué querés hacer?" />
          <button className="btn btn-primary" onClick={() => navigate('/reservar-clases')}>
            <Dumbbell size={17} aria-hidden /> Reservar una clase
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/reservar-canchas')}>
            <Volleyball size={17} aria-hidden /> Reservar una cancha
          </button>
        </section>
      </div>
    </>
  );
}
