import { useState } from 'react';
import { PageHeading, RegisterCta } from '../../../shared/components/Landing';

const TESTIMONIOS = [
  { texto: 'Las canchas siempre están impecables y el sistema de reserva en la app es ultra rápido. Es sin duda el mejor club deportivo de la región.', nombre: 'Carlos Mendoza', desde: 'Socio desde 2021' },
  { texto: 'El ambiente de entrenamiento te empuja a superarte. Los entrenadores realmente se preocupan por corregir tus posturas y evitar lesiones.', nombre: 'Sofía Valenzuela', desde: 'Socio desde 2022' },
  { texto: 'Tener acceso a múltiples sedes me ha facilitado enormemente mantener la constancia en mis entrenamientos pese a mis viajes de trabajo.', nombre: 'Martín Ortega', desde: 'Socio desde 2021' },
];

const FAQS = [
  { pregunta: '¿Cómo me registro?', respuesta: 'Podés registrarte directamente haciendo clic en el botón "Registrarme" en esta web o visitando cualquiera de nuestras sedes. Solo necesitás una identificación oficial y completar tu perfil digital.' },
  { pregunta: '¿Puedo cancelar cuándo quiera?', respuesta: 'Sí, las clases se pueden cancelar sin penalidad hasta 2 horas antes del horario reservado.' },
  { pregunta: '¿Hay descuentos para socios?', respuesta: 'Los socios activos acceden a un 15% de descuento en la reserva de canchas, además de precios preferenciales en las clases grupales.' },
  { pregunta: '¿Qué incluye la membresía?', respuesta: 'Acceso multi-sede, reserva de clases grupales, descuento en canchas deportivas, y control de acceso mediante QR dinámico.' },
  { pregunta: '¿Tienen estacionamiento?', respuesta: 'La disponibilidad de estacionamiento varía según la sede — podés consultarlo en el detalle de cada sucursal.' },
];

export function Nosotros() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <>
      <PageHeading
        title="Quiénes"
        accent="somos."
        description="Un equipo que cree que moverse en compañía cambia todo."
      />

      <section className="bg-[#0A0A0A] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B980FF]">
              Nuestro propósito
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              Redefiniendo el rendimiento.
            </h2>
          </div>
          <p className="flex items-end text-lg leading-relaxed text-white/58">
            En FitZone Sports creemos que el deporte no es solo rutina, sino un estilo de
            vida sin restricciones. Ofrecemos ecosistemas equipados con tecnología de
            análisis corporal, áreas de recuperación y comunidades activas que se apoyan
            mutuamente para alcanzar sus metas diarias.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8B2EFF]">
          Nuestras experiencias
        </p>
        <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.055em] sm:text-6xl">
          Lo que dicen nuestros socios.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIOS.map((t) => (
            <article
              key={t.nombre}
              className="rounded-[1.75rem] border border-black/8 bg-white p-7 sm:p-8"
            >
              <span className="text-4xl font-black text-[#8B2EFF]/25">"</span>
              <p className="mt-2 text-[15px] leading-relaxed text-black/65">
                {t.texto}
              </p>
              <p className="mt-6 border-t border-black/8 pt-4 text-sm font-bold">
                {t.nombre}
              </p>
              <p className="text-xs text-black/40">{t.desde}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8B2EFF]">
          Resolvemos tus dudas
        </p>
        <h2 className="mt-4 text-4xl font-black tracking-[-0.055em] sm:text-6xl">
          Preguntas frecuentes.
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <div key={f.pregunta} className="rounded-2xl border border-black/8 bg-white">
              <button
                className="flex w-full items-center justify-between gap-4 p-6 text-left font-bold"
                onClick={() => setAbierta(abierta === i ? null : i)}
              >
                {f.pregunta}
                <span className="text-xl text-[#8B2EFF]">{abierta === i ? '−' : '+'}</span>
              </button>
              {abierta === i && (
                <p className="px-6 pb-6 text-sm leading-relaxed text-black/55">
                  {f.respuesta}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <RegisterCta copy="Sumate a la comunidad FitZone" />
    </>
  );
}
