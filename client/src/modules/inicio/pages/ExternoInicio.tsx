import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, Sparkles, Volleyball } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../../shared/components/ui';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { IconButton } from '../../../shared/components/IconButton';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { formatearFechaCorta, useProximasReservas } from '../hooks/useProximasReservas';

export function ExternoInicio() {
  useTitulo('Mi panel');
  const { user } = useAuth();
  const navigate = useNavigate();
  // El externo solo puede reservar canchas: sus próximas son solo de ese tipo.
  const { proximas, cargando, error } = useProximasReservas(user?.id, 4);
  const canchas = proximas.filter((p) => p.kind === 'cancha');

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Hola, {user?.nombre}</h2>
          <p>Organizá tu próxima fecha y gestioná tus reservas.</p>
        </div>
      </div>

      <section className="external-hero" aria-label="Reservar cancha">
        <div>
          <span className="eyebrow">TU PRÓXIMO PARTIDO</span>
          <h2>La cancha ya está lista</h2>
          <p>Elegí sede, deporte y horario. Del resto nos ocupamos nosotros.</p>
          <button className="btn btn-primary" onClick={() => navigate('/reservar-canchas')}>
            <Volleyball size={17} aria-hidden /> Reservar cancha
          </button>
        </div>
        <div className="court-visual" aria-hidden />
      </section>

      <div className="content-grid">
        <section className="glass panel" aria-label="Próximas reservas">
          <SectionHeader title="Próximas reservas" description="Tus turnos confirmados." />
          {cargando ? (
            <LoadingState rows={3} label="Cargando reservas" />
          ) : error ? (
            <ErrorState
              title="No pudimos cargar tus reservas"
              description="Revisá tu conexión e intentá de nuevo en unos segundos."
              onRetry={() => window.location.reload()}
            />
          ) : canchas.length === 0 ? (
            <EmptyState
              title="Todavía no tenés turnos"
              description="Reservá una cancha y aparece acá con fecha y horario."
              icon={CalendarDays}
              action={
                <button className="btn btn-secondary" onClick={() => navigate('/reservar-canchas')}>
                  Reservar cancha
                </button>
              }
            />
          ) : (
            <div className="stack-list">
              {canchas.map((item) => (
                <div className="list-row" key={item.id}>
                  <span className="row-icon" aria-hidden>
                    <Volleyball size={20} />
                  </span>
                  <div className="row-main">
                    <strong>{item.titulo}</strong>
                    <span>
                      {formatearFechaCorta(item.fecha)} · {item.hora} · {item.detalle}
                    </span>
                  </div>
                  <Badge variant="info">Cancha</Badge>
                  <IconButton
                    icon={ChevronRight}
                    label={`Ver ${item.titulo}`}
                    onClick={() => navigate('/reservar-canchas')}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass panel benefit-card" aria-label="Hacete socio">
          <Sparkles size={24} aria-hidden />
          <h2>Hacete socio</h2>
          <p>Elegí un plan y pagalo desde la plataforma: cuando el pago se aprueba pasás a ser socio, con reserva de clases grupales y 15% de descuento en canchas.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/completar-membresia')}>
            Conocer membresías
          </button>
        </section>
      </div>
    </>
  );
}
