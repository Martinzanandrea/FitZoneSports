import { useMemo } from 'react';
import { canchasApi, type CanchaPublica } from '../canchas.api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeading, RegisterCta } from '../../../shared/components/Landing';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { formatMoney } from '../../../shared/components/ui';
import { useDatosPublicos } from '../../../shared/hooks/useDatosPublicos';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const IMAGEN_GENERICA = '/images/landing/opt/gimnasio-hero.jpg';

// La API trae imagenUrl por tipo; si falta, se usa una foto local del repo
// que coincida con el nombre del tipo (paddle / fútbol) o la genérica.
function imagenDeTipo(nombre: string, imagenUrl: string | null): string {
  if (imagenUrl) return imagenUrl;
  const clave = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (clave.includes('padel') || clave.includes('paddle')) return '/images/landing/opt/paddle-cancha.jpg';
  if (clave.includes('futbol')) return '/images/landing/opt/futbol5-cancha.jpg';
  return IMAGEN_GENERICA;
}

export function CanchasPublicas() {
  useTitulo('Canchas deportivas');
  const { user } = useAuth();
  const { data, cargando, error, reintentar } = useDatosPublicos(canchasApi.getAllPublico);

  const porTipo = useMemo(() => {
    const mapa = new Map<string, { nombre: string; imagenUrl: string | null; lista: CanchaPublica[] }>();
    for (const c of data ?? []) {
      const grupo = mapa.get(c.tipo.nombre) ?? { nombre: c.tipo.nombre, imagenUrl: c.tipo.imagenUrl, lista: [] };
      grupo.lista.push(c);
      if (!grupo.imagenUrl) grupo.imagenUrl = c.tipo.imagenUrl;
      mapa.set(c.tipo.nombre, grupo);
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [data]);

  return (
    <>
      <PageHeading
        accent="deportivas."
        description="Elegí tu cancha y armá el partido. El valor final varía según la sede, el horario elegido y si sos socio."
        title="Canchas"
      />
      <section className="lp-wrap" style={{ paddingBottom: 'clamp(24px, 5vw, 48px)' }}>
        {cargando ? (
          <LoadingState label="Cargando canchas" rows={3} />
        ) : error ? (
          <ErrorState
            description="No pudimos obtener el catálogo de canchas. Intentá de nuevo en unos segundos."
            onRetry={reintentar}
            title="No pudimos cargar las canchas"
          />
        ) : porTipo.length === 0 ? (
          <EmptyState
            description="Cuando se publiquen canchas deportivas las vas a ver acá."
            title="Todavía no hay canchas publicadas"
          />
        ) : (
          porTipo.map((grupo, index) => (
            <article className="lp-court" key={grupo.nombre}>
              <div className="lp-court-banner">
                <img
                  alt={`Cancha de ${grupo.nombre}`}
                  decoding="async"
                  height={630}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  src={imagenDeTipo(grupo.nombre, grupo.imagenUrl)}
                  width={1440}
                />
                <div>
                  <span className="lp-eyebrow">Reservá tu turno · 0{index + 1}</span>
                  <h2>{grupo.nombre}</h2>
                </div>
              </div>
              <div className="lp-court-list">
                {grupo.lista.map((cancha, i) => (
                  <div className="lp-court-row glass" key={`${grupo.nombre}-${cancha.sede}-${i}`}>
                    <h3>{cancha.sede}</h3>
                    <div className="lp-price">
                      <small>Precio base</small>
                      <strong>{formatMoney(Number(cancha.costoHoraBase))}</strong>
                      <small>por hora</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
        <aside className="lp-note glass">
          <span className="lp-eyebrow">Precio dinámico</span>
          <h2>Pagás según cuándo jugás.</h2>
          <p>
            Los socios con membresía activa reciben un 15% de descuento sobre el precio base y los
            horarios pico pueden tener un valor adicional. Siempre ves el total antes de reservar.
          </p>
        </aside>
      </section>
      <RegisterCta
        copy={user ? 'Reservá tu horario' : 'Registrate para reservar tu horario'}
        ctaLabel={user ? 'Reservar ahora' : undefined}
        footnote={user ? 'Tenés sesión iniciada. Elegí tu próximo turno.' : undefined}
        to={user ? '/reservar-canchas' : '/registro'}
      />
    </>
  );
}
