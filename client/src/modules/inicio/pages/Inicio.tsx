import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sedesApi } from '../../sedes/sedes.api';
import { ArrowIcon, RegisterCta } from '../../../shared/components/Landing';

export function Inicio() {
  const [sedesActivas, setSedesActivas] = useState(0);

  useEffect(() => {
    sedesApi
      .getAllPublico()
      .then((data) => setSedesActivas(data.filter((s) => s.activa !== false).length))
      .catch(() => setSedesActivas(0));
  }, []);

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:px-12 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#EEE1FF] px-3.5 py-2 text-[11px] font-extrabold tracking-[0.16em] text-[#7119DE]">
            <span className="size-1.5 rounded-full bg-[#8B2EFF]" />
            TU LUGAR PARA MOVERTE
          </div>
          <h1 className="text-[clamp(3.7rem,8vw,7.2rem)] font-black leading-[0.86] tracking-[-0.075em]">
            Más que
            <br />
            entrenar.
            <br />
            <span className="text-[#8B2EFF]">Es pertenecer.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-black/58 sm:text-xl">
            Creamos espacios donde el deporte conecta personas, transforma rutinas y
            se vuelve una experiencia que querés repetir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="group flex items-center gap-2 rounded-full bg-[#8B2EFF] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#7720E6]"
              to="/registro"
            >
              Sumate a FitZone
              <ArrowIcon />
            </Link>
            <a
              className="rounded-full border border-black/15 px-6 py-3.5 text-sm font-bold transition-colors hover:border-black"
              href="#mision"
            >
              Conocenos
            </a>
          </div>
        </div>
        <div className="relative min-h-[480px] lg:min-h-[620px]">
          <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
            <img
              alt="Personas entrenando juntas en un gimnasio"
              className="h-full w-full object-cover"
              src="/images/landing/gimnasio-hero.jpg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          </div>
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between rounded-2xl border border-white/20 bg-black/25 p-5 text-white backdrop-blur-md sm:bottom-7 sm:left-7 sm:right-7">
            <p className="max-w-xs text-lg font-bold leading-tight">
              Una comunidad que se mueve con vos.
            </p>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">
              {sedesActivas} {sedesActivas === 1 ? 'sede' : 'sedes'}
            </span>
          </div>
          <div className="absolute -left-4 top-8 rotate-[-7deg] rounded-full bg-[#D8FF59] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] sm:-left-8">
            Energía real
          </div>
        </div>
      </section>

      <section className="bg-[#0A0A0A] py-20 text-white sm:py-28" id="mision">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B980FF]">
              Nuestra misión
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              Que moverte sea la mejor parte de tu día.
            </h2>
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-lg leading-relaxed text-white/58">
              En FitZoneSports creemos que el bienestar no se construye con fórmulas.
              Se construye con espacios que inspiran, profesionales que acompañan y
              una comunidad que te impulsa a volver.
            </p>
            <div className="mt-9 grid grid-cols-3 gap-4 border-t border-white/12 pt-7">
              {[
                ['6', 'Sedes'],
                ['50+', 'Profesionales'],
                ['12k', 'Personas activas'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-3xl font-black tracking-[-0.05em] text-[#B980FF] sm:text-4xl">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-white/38">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8B2EFF]">
            La experiencia FitZone
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.055em] sm:text-6xl">
            Todo lo que necesitás para sentirte bien.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
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
          ].map((item) => (
            <article
              className="rounded-[1.75rem] border border-black/8 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#8B2EFF]/25 hover:shadow-[0_20px_45px_-25px_rgba(139,46,255,0.4)] sm:p-8"
              key={item.number}
            >
              <span className="text-xs font-black text-[#8B2EFF]">{item.number}</span>
              <h3 className="mt-16 text-2xl font-black tracking-[-0.04em]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-black/50">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-12 lg:pb-32">
        <div className="order-2 lg:order-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8B2EFF]">
            Hecho para tu vida
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
            Tu ritmo.
            <br />
            Tu lugar.
          </h2>
          <p className="mt-6 max-w-lg leading-relaxed text-black/55">
            Distintas sedes, propuestas y horarios para que el movimiento se adapte a
            vos, no al revés. Llegás como sos y elegís cómo querés vivirlo.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              className="group flex items-center gap-2 text-sm font-black text-[#8B2EFF]"
              to="/clases"
            >
              Explorar experiencias
              <ArrowIcon />
            </Link>
          </div>
        </div>
        <div className="order-1 h-[420px] overflow-hidden rounded-[2rem] lg:order-2 lg:h-[560px]">
          <img
            alt="Atleta entrenando con sogas en un gimnasio"
            className="h-full w-full object-cover"
            src="/images/landing/gimnasio-alt.jpg"
          />
        </div>
      </section>

      <RegisterCta copy="Tu próxima versión empieza acá" />
    </>
  );
}
