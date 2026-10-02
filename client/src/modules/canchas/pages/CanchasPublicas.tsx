import { useEffect, useMemo, useState } from 'react';
import { canchasApi, type CanchaPublica } from '../canchas.api';
import { useAuth } from '../../auth/AuthContext';
import { PageHeading, RegisterCta } from '../../../shared/components/Landing';
import { formatMoney } from '../../../shared/components/ui';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const IMAGEN_GENERICA = '/images/landing/gimnasio-alt.jpg';

export function CanchasPublicas() {
  useTitulo('Canchas deportivas');
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
    const mapa = new Map<string, { nombre: string; imagenUrl: string | null; lista: CanchaPublica[] }>();
    for (const c of canchas) {
      const grupo = mapa.get(c.tipo.nombre) ?? { nombre: c.tipo.nombre, imagenUrl: c.tipo.imagenUrl, lista: [] };
      grupo.lista.push(c);
      // La primera imagen del grupo alcanza: todas las canchas del mismo
      // tipo comparten imagenUrl (viene del catálogo).
      if (!grupo.imagenUrl) grupo.imagenUrl = c.tipo.imagenUrl;
      mapa.set(c.tipo.nombre, grupo);
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
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
          porTipo.map((grupo, index) => {
            const imagen = grupo.imagenUrl ?? IMAGEN_GENERICA;
            return (
              <article key={grupo.nombre}>
                <div className="group relative h-60 overflow-hidden rounded-[1.75rem] bg-black sm:h-72 lg:h-80">
                  <img
                    alt={`Cancha de ${grupo.nombre}`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                    src={imagen}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white sm:p-9">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">
                        Reservá tu turno
                      </p>
                      <h2 className="text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
                        {grupo.nombre}
                      </h2>
                    </div>
                    <span className="hidden text-sm font-bold text-white/60 sm:block">
                      0{index + 1}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  {grupo.lista.map((location, i) => (
                    <div
                      className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white p-5 transition-all hover:border-[#8B2EFF]/25 hover:shadow-[0_16px_35px_-22px_rgba(139,46,255,0.55)] sm:p-6"
                      key={`${grupo.nombre}-${location.sede}-${i}`}
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
