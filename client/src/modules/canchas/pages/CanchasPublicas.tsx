import { useEffect, useMemo, useState } from 'react';
import { canchasApi, type CanchaPublica } from '../canchas.api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeading, RegisterCta } from '../../../shared/components/Landing';
import { formatMoney } from '../../../shared/components/ui';

const BANNERS: Record<string, { eyebrow: string; image: string; alt: string }> = {
  PADDLE: {
    eyebrow: 'Paleta, paredes y mucha adrenalina',
    image: '/images/landing/paddle-cancha.jpg',
    alt: 'Cancha de paddle rodeada por paredes de vidrio',
  },
  FUTBOL5: {
    eyebrow: 'Armá el equipo, la cancha está lista',
    image: '/images/landing/futbol5-cancha.jpg',
    alt: 'Cancha de fútbol iluminada por reflectores',
  },
};

const BANNER_GENERICO = {
  eyebrow: 'Reservá tu turno',
  image: '/images/landing/gimnasio-alt.jpg',
  alt: 'Cancha deportiva',
};

export function CanchasPublicas() {
  const { user } = useAuth();
  const [canchas, setCanchas] = useState<CanchaPublica[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    canchasApi
      .getAllPublico()
      .then(setCanchas)
      .catch(() => setCanchas([]))
      .finally(() => setCargando(false));
  }, []);

  const porTipo = useMemo(() => {
    const mapa = new Map<string, CanchaPublica[]>();
    for (const c of canchas) {
      const lista = mapa.get(c.tipo) ?? [];
      lista.push(c);
      mapa.set(c.tipo, lista);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [canchas]);

  return (
    <>
      <PageHeading
        accent="deportivas."
        description="Elegí tu cancha y armá el partido. El valor final varía según la sede, el horario elegido y si sos socio."
        title="Canchas"
      />
      <section className="mx-auto max-w-7xl space-y-16 px-5 pb-24 sm:space-y-20 sm:px-8 lg:px-12 lg:pb-32">
        {cargando ? (
          <p className="text-sm text-black/50">Cargando canchas…</p>
        ) : porTipo.length === 0 ? (
          <p className="text-sm text-black/50">Todavía no hay canchas publicadas.</p>
        ) : (
          porTipo.map(([tipo, lista], index) => {
            const banner = BANNERS[tipo] ?? BANNER_GENERICO;
            return (
              <article key={tipo}>
                <div className="group relative h-60 overflow-hidden rounded-[1.75rem] bg-black sm:h-72 lg:h-80">
                  <img
                    alt={banner.alt}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                    src={banner.image}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white sm:p-9">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">
                        {banner.eyebrow}
                      </p>
                      <h2 className="text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
                        {tipo === 'FUTBOL5' ? 'Fútbol 5' : tipo.charAt(0) + tipo.slice(1).toLowerCase()}
                      </h2>
                    </div>
                    <span className="hidden text-sm font-bold text-white/60 sm:block">
                      0{index + 1}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  {lista.map((location, i) => (
                    <div
                      className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white p-5 transition-all hover:border-[#8B2EFF]/25 hover:shadow-[0_16px_35px_-22px_rgba(139,46,255,0.55)] sm:p-6"
                      key={`${tipo}-${location.sede}-${i}`}
                    >
                      <div>
                        <h3 className="text-lg font-extrabold tracking-[-0.025em] sm:text-xl">
                          {location.sede}
                        </h3>
                      </div>
                      <div className="shrink-0 border-l border-black/8 pl-4 text-right sm:pl-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">
                          Desde
                        </p>
                        <p className="text-xl font-black tracking-[-0.04em] text-[#8B2EFF] sm:text-2xl">
                          {formatMoney(Number(location.costoHoraBase))}
                        </p>
                        <p className="text-[10px] text-black/35">por hora</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
        <aside className="relative overflow-hidden rounded-[1.75rem] bg-[#EEE1FF] p-6 sm:p-9 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:p-10">
          <div className="relative">
            <div className="mb-5 grid size-11 place-items-center rounded-full bg-[#8B2EFF] text-lg font-black text-white">
              $
            </div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6E18D2]">
              Precio dinámico
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              Pagás según cuándo jugás.
            </h2>
          </div>
          <p className="relative mt-5 max-w-xl text-[15px] leading-relaxed text-black/60 sm:text-base lg:mt-0">
            El precio se ajusta según la demanda. Los socios acceden a valores
            preferenciales y los horarios pico pueden tener un valor adicional.
            Siempre ves el total antes de reservar.
          </p>
        </aside>
      </section>
      <RegisterCta
        copy={user ? 'Reservá tu horario' : 'Registrate para reservar tu horario'}
        to={user ? '/reservar-canchas' : '/registro'}
        ctaLabel={user ? 'Reservar ahora' : undefined}
        footnote={user ? 'Tenés sesión iniciada. Elegí tu próximo turno.' : undefined}
      />
    </>
  );
}
