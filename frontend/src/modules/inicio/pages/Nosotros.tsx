import { useState } from 'react';
import { PageHeading, RegisterCta } from '../../../shared/components/organisms';;
import { useTitulo } from '../../../shared/hooks/useTitulo';

// Preguntas frecuentes: solo reglas que existen en el sistema (descuento de
// socio en canchas, límite de cancelación de clases, verificación de email,
// QR dinámico y acceso multi-sede).
const FAQS = [
  {
    pregunta: '¿Cómo me registro?',
    respuesta:
      'Podés registrarte desde el botón "Registrarme" de esta web. Completás tus datos personales y verificás tu email para poder ingresar.',
  },
  {
    pregunta: '¿Puedo cancelar una clase?',
    respuesta: 'Sí, las reservas de clases se pueden cancelar hasta 2 horas antes del inicio.',
  },
  {
    pregunta: '¿Hay descuentos para socios?',
    respuesta: 'Los socios con membresía activa acceden a un 15% de descuento en la reserva de canchas.',
  },
  {
    pregunta: '¿Qué incluye la membresía?',
    respuesta:
      'Acceso multi-sede, reserva de clases grupales, descuento en canchas deportivas, y control de acceso mediante QR dinámico.',
  },
];

export function Nosotros() {
  useTitulo('Quiénes somos');
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <>
      <PageHeading
        accent="somos."
        description="Un equipo que cree que moverse en compañía cambia todo."
        eyebrow="Nosotros"
        title="Quiénes"
      />

      <section className="lp-wrap" style={{ paddingBottom: 'clamp(40px, 7vw, 80px)' }}>
        <div className="lp-card glass" style={{ padding: 'clamp(24px, 5vw, 48px)', gap: 18 }}>
          <span className="lp-eyebrow">Nuestro propósito</span>
          <h2 className="lp-h2">
            Redefiniendo <em>el rendimiento.</em>
          </h2>
          <p className="lp-lead">
            En FitZone Sports creemos que el deporte no es solo rutina, sino un estilo de vida sin
            restricciones. Ofrecemos ecosistemas equipados con tecnología de análisis corporal, áreas
            de recuperación y comunidades activas que se apoyan mutuamente para alcanzar sus metas
            diarias.
          </p>
        </div>
      </section>

      <section className="lp-wrap" style={{ paddingBottom: 'clamp(24px, 5vw, 48px)' }}>
        <div className="lp-head">
          <span className="lp-eyebrow">Resolvemos tus dudas</span>
          <h2 className="lp-h2">
            Preguntas <em>frecuentes.</em>
          </h2>
        </div>
        <div className="lp-faq">
          {FAQS.map((f, i) => {
            const abiertaAhora = abierta === i;
            return (
              <div className="lp-faq-item glass" key={f.pregunta}>
                <button
                  aria-controls={`faq-${i}`}
                  aria-expanded={abiertaAhora}
                  id={`faq-btn-${i}`}
                  onClick={() => setAbierta(abiertaAhora ? null : i)}
                  type="button"
                >
                  {f.pregunta}
                  <span aria-hidden="true">{abiertaAhora ? '−' : '+'}</span>
                </button>
                {abiertaAhora && (
                  <p aria-labelledby={`faq-btn-${i}`} id={`faq-${i}`} role="region">
                    {f.respuesta}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <RegisterCta copy="Sumate a la comunidad FitZone" />
    </>
  );
}
