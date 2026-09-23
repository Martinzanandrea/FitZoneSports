import { useEffect, useState } from 'react';
import { clasesApi, type ResumenClasePublica } from '../clases.api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeading, RegisterCta } from '../../../shared/components/Landing';

interface FichaClase {
  name: string;
  description: string;
  image: string;
  alt: string;
  accent: string;
}

// Mismas descripciones del diseño Figma, matcheables por tipoClase en
// minúsculas sin tildes. Imágenes locales (sin hotlinks).
const FICHAS: Record<string, FichaClase> = {
  yoga: {
    name: 'Yoga Flow',
    description: 'Respirá, soltá y movete a tu ritmo. Una práctica para volver al centro.',
    image: '/images/landing/yoga-clase.jpg',
    alt: 'Grupo practicando yoga en un estudio',
    accent: 'bg-[#D8FF59] text-[#0A0A0A]',
  },
  spinning: {
    name: 'Ride',
    description: 'Música arriba, luces bajas y energía en equipo. Pedaleá y salí con todo.',
    image: '/images/landing/spinning-clase.jpg',
    alt: 'Personas entrenando en bicicletas de spinning',
    accent: 'bg-[#FF693A] text-white',
  },
  funcional: {
    name: 'Functional Team',
    description: 'Fuerza, agilidad y potencia en circuitos dinámicos que nunca son iguales.',
    image: '/images/landing/gimnasio-alt.jpg',
    alt: 'Entrenamiento funcional en gimnasio',
    accent: 'bg-[#8B2EFF] text-white',
  },
  pilates: {
    name: 'Pilates Reformer',
    description: 'Control, precisión y fuerza profunda para descubrir una forma de moverte mejor.',
    image: '/images/landing/yoga-alt.jpg',
    alt: 'Persona practicando pilates',
    accent: 'bg-[#FFB7DF] text-[#0A0A0A]',
  },
};

const FICHA_GENERICA: FichaClase = {
  name: '',
  description: 'Entrenamientos grupales con acompañamiento profesional en todas las sedes.',
  image: '/images/landing/gimnasio-alt.jpg',
  alt: 'Entrenamiento grupal en gimnasio',
  accent: 'bg-[#8B2EFF] text-white',
};

function normalizarTipo(tipoClase: string): string {
  return tipoClase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function ClasesPublicas() {
  const { user } = useAuth();
  const [resumen, setResumen] = useState<ResumenClasePublica[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    clasesApi
      .getAllPublico()
      .then(setResumen)
      .catch(() => setResumen([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
      <PageHeading
        accent="grupales."
        description="Entrenar se siente distinto cuando lo hacés con otros. Encontrá la clase que te enciende."
        title="Clases"
      />
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        {cargando ? (
          <p className="text-sm text-black/50">Cargando clases…</p>
        ) : resumen.length === 0 ? (
          <p className="text-sm text-black/50">Todavía no hay clases publicadas.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            {resumen.map((item) => {
              const ficha = FICHAS[normalizarTipo(item.tipoClase)] ?? {
                ...FICHA_GENERICA,
                name: item.tipoClase,
              };
              return (
                <article
                  className="group overflow-hidden rounded-[1.75rem] border border-black/8 bg-white transition-all duration-500 hover:-translate-y-1 hover:border-[#8B2EFF]/25 hover:shadow-[0_24px_60px_-24px_rgba(139,46,255,0.42)]"
                  key={item.tipoClase}
                >
                  <div className="relative aspect-video overflow-hidden bg-black/5">
                    <img
                      alt={ficha.alt}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.055]"
                      src={ficha.image}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <span
                      className={`absolute left-5 top-5 rounded-full px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.12em] shadow-lg ${ficha.accent}`}
                    >
                      {item.tipoClase}
                    </span>
                  </div>
                  <div className="p-6 sm:p-8">
                    <h2 className="text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
                      {ficha.name}
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-black/58 sm:min-h-[3.25rem] sm:text-base">
                      {ficha.description}
                    </p>
                    <p className="mt-6 border-t border-black/8 pt-5 text-xs font-semibold text-black/40">
                      Disponible en {item.sedesQueOfrecen} {item.sedesQueOfrecen === 1 ? 'sede' : 'sedes'} · {item.horasSemanalesTotales} hs semanales
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <RegisterCta
        copy={user ? 'Ver horarios y reservar' : 'Registrate para ver horarios y reservar'}
        to={user ? '/reservar-clases' : '/registro'}
        ctaLabel={user ? 'Reservar ahora' : undefined}
        footnote={user ? 'Tenés sesión iniciada. Elegí tu próximo turno.' : undefined}
      />
    </>
  );
}
