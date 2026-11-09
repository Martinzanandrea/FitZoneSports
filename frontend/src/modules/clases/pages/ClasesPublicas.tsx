import { clasesApi } from '../clases.api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeading, RegisterCta } from '../../../shared/components/organisms';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { useDatosPublicos } from '../../../shared/hooks/useDatosPublicos';
import { useTitulo } from '../../../shared/hooks/useTitulo';

interface FotoClase {
  src: string;
  alt: string;
  width: number;
  height: number;
}

// Fotos locales del repo, elegidas por tipo de clase (sin tildes, minúsculas).
// El nombre que se muestra es siempre el tipo real que devuelve la API.
const FOTOS: Record<string, FotoClase> = {
  yoga: { src: '/images/landing/opt/yoga-clase.jpg', alt: 'Grupo practicando yoga en un estudio', width: 1400, height: 933 },
  spinning: { src: '/images/landing/opt/spinning-clase.jpg', alt: 'Personas entrenando en bicicletas de spinning', width: 933, height: 1400 },
  pilates: { src: '/images/landing/opt/yoga-alt.jpg', alt: 'Persona practicando pilates', width: 933, height: 1400 },
};

const FOTO_GENERICA: FotoClase = {
  src: '/images/landing/opt/gimnasio-alt.jpg',
  alt: 'Entrenamiento grupal en gimnasio',
  width: 934,
  height: 1400,
};

function normalizarTipo(tipoClase: string): string {
  return tipoClase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function fotoPara(tipoClase: string): FotoClase {
  const clave = normalizarTipo(tipoClase);
  const hallada = Object.keys(FOTOS).find((k) => clave.includes(k));
  return hallada ? FOTOS[hallada] : FOTO_GENERICA;
}

export function ClasesPublicas() {
  useTitulo('Clases grupales');
  const { user } = useAuth();
  const { data, cargando, error, reintentar } = useDatosPublicos(clasesApi.getAllPublico);

  return (
    <>
      <PageHeading
        accent="grupales."
        description="Entrenar se siente distinto cuando lo hacés con otros. Encontrá la clase que te enciende."
        title="Clases"
      />
      <section className="lp-wrap" style={{ paddingBottom: 'clamp(24px, 5vw, 48px)' }}>
        {cargando ? (
          <LoadingState label="Cargando clases" rows={3} />
        ) : error ? (
          <ErrorState
            description="No pudimos obtener el catálogo de clases. Intentá de nuevo en unos segundos."
            onRetry={reintentar}
            title="No pudimos cargar las clases"
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            description="Cuando se publiquen clases grupales las vas a ver acá."
            title="Todavía no hay clases publicadas"
          />
        ) : (
          <div className="lp-grid lp-grid-2">
            {data.map((item, i) => {
              const foto = fotoPara(item.tipoClase);
              return (
                <article className="lp-photo-card glass" key={item.tipoClase}>
                  <div className="lp-photo">
                    <img
                      alt={foto.alt}
                      decoding="async"
                      height={foto.height}
                      loading={i < 2 ? 'eager' : 'lazy'}
                      src={foto.src}
                      width={foto.width}
                    />
                    <span className="lp-photo-tag">0{i + 1}</span>
                  </div>
                  <div className="lp-photo-body">
                    <h2>{item.tipoClase}</h2>
                    <div className="lp-meta">
                      <span>
                        <b>{item.sedesQueOfrecen}</b>
                        {item.sedesQueOfrecen === 1 ? 'sede' : 'sedes'}
                      </span>
                      <span>
                        <b>{item.horasSemanalesTotales}</b>hs semanales
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="lp-note glass">
          <span className="lp-eyebrow">Cupos</span>
          <h2>¿Cupo completo?</h2>
          <p>Si la clase se llena, entrás en la lista de espera y te avisamos cuando se libera un lugar.</p>
        </div>
      </section>
      <RegisterCta
        copy={user ? 'Ver horarios y reservar' : 'Registrate para ver horarios y reservar'}
        ctaLabel={user ? 'Reservar ahora' : undefined}
        footnote={user ? 'Tenés sesión iniciada. Elegí tu próximo turno.' : undefined}
        to={user ? '/reservar-clases' : '/registro'}
      />
    </>
  );
}
