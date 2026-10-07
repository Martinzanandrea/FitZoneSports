import { MapPin } from 'lucide-react';
import { sedesApi } from '../sedes.api';
import { PageHeading, PinIcon, RegisterCta } from '../../../shared/components/Landing';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { useDatosPublicos } from '../../../shared/hooks/useDatosPublicos';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function SedesPublicas() {
  useTitulo('Nuestras sedes');
  const { data, cargando, error, reintentar } = useDatosPublicos(sedesApi.getAllPublico);
  const sedes = (data ?? []).filter((s) => s.activa !== false);

  return (
    <>
      <PageHeading
        accent="sedes."
        description="Un solo abono te da acceso a todas. Elegí la que te quede más cerca."
        title="Nuestras"
      />
      <section className="lp-wrap" style={{ paddingBottom: 'clamp(24px, 5vw, 48px)' }}>
        {cargando ? (
          <LoadingState label="Cargando sedes" rows={3} />
        ) : error ? (
          <ErrorState
            description="No pudimos obtener las sedes. Intentá de nuevo en unos segundos."
            onRetry={reintentar}
            title="No pudimos cargar las sedes"
          />
        ) : sedes.length === 0 ? (
          <EmptyState
            description="Cuando se publiquen sedes las vas a ver acá."
            icon={MapPin}
            title="Todavía no hay sedes publicadas"
          />
        ) : (
          <div className="lp-grid lp-grid-3">
            {sedes.map((sede) => (
              <article className="lp-card glass" key={sede.id}>
                <div className="lp-card-icon">
                  <PinIcon />
                </div>
                <h2 style={{ font: '800 1.6rem/1.1 var(--font-title)', letterSpacing: '-0.03em', overflowWrap: 'anywhere' }}>
                  {sede.nombre}
                </h2>
                <p>{sede.direccion}</p>
                <p className="lp-meta">
                  {sede.franjas?.length
                    ? sede.franjas.map((f) => `${f.apertura.slice(0, 5)}–${f.cierre.slice(0, 5)}`).join(' · ')
                    : 'Horario a confirmar'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <RegisterCta copy="Encontrá tu sede y sumate hoy" />
    </>
  );
}
