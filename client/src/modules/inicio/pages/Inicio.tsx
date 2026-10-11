import { Link } from 'react-router-dom';
import { sedesApi } from '../../sedes/sedes.api';
import { clasesApi } from '../../clases/clases.api';
import { canchasApi } from '../../canchas/canchas.api';
import { preciosApi } from '../../precios/precios.api';
import type { PrecioPlan } from '../../precios/precios.types';
import { ArrowIcon, RegisterCta } from '../../../shared/components/organisms';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { formatMoney } from '../../../shared/utils/formatMoney';
import { useDestinoMembresia } from '../../../shared/hooks/useDestinoMembresia';
import { useDatosPublicos } from '../../../shared/hooks/useDatosPublicos';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const ORDEN_PLANES: PrecioPlan['plan'][] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];
const MESES_PLAN: Record<PrecioPlan['plan'], number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };
const NOMBRE_PLAN: Record<PrecioPlan['plan'], string> = {
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
};

const PUNTOS = [
  ['01', 'Ingresás con QR dinámico'],
  ['02', 'Reservás clases y canchas desde la plataforma'],
  ['03', 'Un solo abono te da acceso a todas las sedes'],
];

const EXPERIENCIA = [
  {
    number: '01',
    title: 'Espacios que inspiran',
    text: 'Ambientes cuidados, equipamiento moderno y sedes pensadas para disfrutar cada visita.',
  },
  {
    number: '02',
    title: 'Acompañamiento real',
    text: 'Un equipo cercano que entiende tus objetivos y te ayuda a encontrar tu propio ritmo.',
  },
  {
    number: '03',
    title: 'Comunidad activa',
    text: 'Personas distintas unidas por las ganas de moverse, compartir y sentirse mejor.',
  },
];

export function Inicio() {
  useTitulo('Inicio');
  const destino = useDestinoMembresia();
  const sedes = useDatosPublicos(sedesApi.getAllPublico);
  const clases = useDatosPublicos(clasesApi.getAllPublico);
  const canchas = useDatosPublicos(canchasApi.getAllPublico);
  const precios = useDatosPublicos(preciosApi.getMembresiasPublico);

  const sedesActivas = (sedes.data ?? []).filter((s) => s.activa !== false).length;

  // Marquee con las actividades reales publicadas (tipos de clase y de cancha).
  const actividades = Array.from(
    new Set([
      ...(clases.data ?? []).map((c) => c.tipoClase),
      ...(canchas.data ?? []).map((c) => c.tipo.nombre),
    ]),
  );

  const planes = (precios.data ?? [])
    .filter((p) => ORDEN_PLANES.includes(p.plan))
    .sort((a, b) => ORDEN_PLANES.indexOf(a.plan) - ORDEN_PLANES.indexOf(b.plan));

  return (
    <>
      <section className="lp-wrap lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">Tu lugar para moverte</span>
          <h1 className="lp-h1">
            Más que entrenar. <em>Es pertenecer.</em>
          </h1>
          <p className="lp-lead">
            Creamos espacios donde el deporte conecta personas, transforma rutinas y se vuelve una
            experiencia que querés repetir.
          </p>
          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-primary" to="/registro">
              Sumate a FitZone
              <ArrowIcon />
            </Link>
            <Link className="lp-btn lp-btn-secondary" to="/nosotros">
              Conocenos
            </Link>
          </div>
        </div>
        <div className="lp-hero-media">
          <img
            alt="Personas entrenando juntas en un gimnasio"
            decoding="async"
            fetchPriority="high"
            height={934}
            src="/images/landing/opt/gimnasio-hero.jpg"
            width={1400}
          />
          <div className="lp-hero-chip glass">
            <p>Una comunidad que se mueve con vos.</p>
            {sedesActivas > 0 && (
              <span>
                {sedesActivas} {sedesActivas === 1 ? 'sede' : 'sedes'}
              </span>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Cómo funciona" className="lp-strip">
        <div className="lp-wrap lp-strip-grid">
          {PUNTOS.map(([n, texto]) => (
            <div className="lp-strip-item" key={n}>
              <span aria-hidden="true">{n}</span>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-wrap lp-section" id="mision">
        <div className="lp-head">
          <span className="lp-eyebrow">Nuestra misión</span>
          <h2 className="lp-h2">
            Que moverte sea <em>la mejor parte</em> de tu día.
          </h2>
          <p className="lp-lead">
            En FitZoneSports creemos que el bienestar no se construye con fórmulas. Se construye con
            espacios que inspiran, profesionales que acompañan y una comunidad que te impulsa a
            volver.
          </p>
        </div>
        <div className="lp-grid lp-grid-3">
          {EXPERIENCIA.map((item) => (
            <article className="lp-card glass" key={item.number}>
              <span className="lp-card-num">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-wrap" style={{ paddingBottom: 'clamp(40px, 7vw, 80px)' }}>
        <div className="lp-head">
          <span className="lp-eyebrow">Hecho para tu vida</span>
          <h2 className="lp-h2">
            Tu ritmo. <em>Tu lugar.</em>
          </h2>
          <p className="lp-lead">
            Distintas sedes, propuestas y horarios para que el movimiento se adapte a vos, no al
            revés.
          </p>
        </div>
        <div className="lp-grid lp-grid-2">
          <article className="lp-photo-card glass">
            <div className="lp-photo">
              <img
                alt="Grupo practicando yoga en un estudio"
                decoding="async"
                height={933}
                loading="lazy"
                src="/images/landing/opt/yoga-clase.jpg"
                width={1400}
              />
              <span className="lp-photo-tag">Clases grupales</span>
            </div>
            <div className="lp-photo-body">
              <h3>Clases que te llevan a otro ritmo</h3>
              <Link className="lp-link" to="/clases">
                Explorar clases <ArrowIcon />
              </Link>
            </div>
          </article>
          <article className="lp-photo-card glass">
            <div className="lp-photo">
              <img
                alt="Cancha de fútbol 5"
                decoding="async"
                height={792}
                loading="lazy"
                src="/images/landing/opt/futbol5-cancha.jpg"
                width={1400}
              />
              <span className="lp-photo-tag">Canchas deportivas</span>
            </div>
            <div className="lp-photo-body">
              <h3>Tu próximo partido empieza acá</h3>
              <Link className="lp-link" to="/canchas">
                Ver canchas <ArrowIcon />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {actividades.length > 0 && (
        <div aria-label={`Actividades: ${actividades.join(', ')}`} className="lp-marquee" role="img">
          <div aria-hidden="true" className="lp-marquee-track">
            {[...actividades, ...actividades, ...actividades, ...actividades].map((a, i) => (
              <span key={i}>{a}</span>
            ))}
          </div>
        </div>
      )}

      <section className="lp-wrap lp-section" id="planes">
        <div className="lp-head">
          <span className="lp-eyebrow">Planes y precios</span>
          <h2 className="lp-h2">
            Encontrá tu <em>frecuencia.</em>
          </h2>
        </div>
        {precios.cargando ? (
          <LoadingState label="Cargando planes" rows={3} />
        ) : precios.error ? (
          <ErrorState
            description="No pudimos obtener los precios de los planes. Intentá de nuevo en unos segundos."
            onRetry={precios.reintentar}
            title="No pudimos cargar los planes"
          />
        ) : planes.length === 0 ? (
          <EmptyState
            description="Cuando se publiquen los precios de las membresías los vas a ver acá."
            title="Todavía no hay planes publicados"
          />
        ) : (
          <div className="lp-grid lp-grid-3">
            {planes.map((p, i) => {
              const meses = MESES_PLAN[p.plan];
              const total = Number(p.precio);
              return (
                <article className="lp-plan glass" key={p.id}>
                  <span className="lp-card-num">0{i + 1}</span>
                  <h3 className="lp-h2" style={{ fontSize: '1.9rem' }}>
                    {NOMBRE_PLAN[p.plan]}
                  </h3>
                  <p className="lp-plan-price">{formatMoney(total)}</p>
                  <p>
                    {meses === 1
                      ? 'Pago por mes'
                      : `Pago por ${meses} meses · equivale a ${formatMoney(Math.round(total / meses))} por mes`}
                  </p>
                  <Link className="lp-btn lp-btn-primary" to={destino.to}>
                    {destino.label}
                    <ArrowIcon />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <RegisterCta copy="Tu próxima versión empieza acá" />
    </>
  );
}
