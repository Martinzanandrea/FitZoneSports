import { useEffect, useState } from 'react';
import { sedesApi } from '../sedes.api';
import type { SedePublica } from '../sedes.types';
import { PageHeading, PinIcon, RegisterCta } from '../../../shared/components/Landing';

export function SedesPublicas() {
  const [sedes, setSedes] = useState<SedePublica[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    sedesApi
      .getAllPublico()
      .then((data) => setSedes(data.filter((s) => s.activa !== false)))
      .catch(() => setSedes([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
      <PageHeading
        title="Nuestras"
        accent="sedes."
        description="Un solo abono te da acceso a todas. Elegí la que te quede más cerca."
      />
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        {cargando ? (
          <p className="text-sm text-black/50">Cargando sedes…</p>
        ) : sedes.length === 0 ? (
          <p className="text-sm text-black/50">Todavía no hay sedes publicadas.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {sedes.map((sede) => (
              <article
                key={sede.id}
                className="group rounded-[1.75rem] border border-black/8 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#8B2EFF]/25 hover:shadow-[0_20px_45px_-25px_rgba(139,46,255,0.4)] sm:p-8"
              >
                <div className="flex size-11 items-center justify-center rounded-full bg-[#EEE1FF] text-[#7119DE]">
                  <PinIcon />
                </div>
                <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">
                  {sede.nombre}
                </h2>
                <p className="mt-2 text-sm text-black/55">{sede.direccion}</p>
                <p className="mt-5 border-t border-black/8 pt-4 text-xs font-semibold text-black/40">
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
