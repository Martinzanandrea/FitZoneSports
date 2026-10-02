import { PageHeading } from '../../../shared/components/Landing';

const SECCIONES: { titulo: string; cuerpo: string }[] = [
  {
    titulo: '1. Objeto',
    cuerpo:
      'Los presentes términos regulan el uso de la plataforma FitZone Sports, un sistema de gestión para gimnasios desarrollado con fines académicos en el marco de la Licenciatura en Sistemas de Información (UNER). Al registrarte y utilizar la plataforma, aceptás estos términos.',
  },
  {
    titulo: '2. Uso de la plataforma',
    cuerpo:
      'La plataforma permite gestionar membresías, reservar clases grupales y canchas deportivas, y acceder a las instalaciones mediante código QR. El uso está destinado a socios, clientes externos y personal autorizado de la cadena de gimnasios.',
  },
  {
    titulo: '3. Cuentas de usuario',
    cuerpo:
      'Cada usuario es responsable de mantener la confidencialidad de su contraseña. El registro requiere verificación de email antes de poder acceder a la plataforma.',
  },
  {
    titulo: '4. Membresías y pagos',
    cuerpo:
      'Las membresías se renuevan según el plan contratado. Los pagos procesados en esta plataforma corresponden a un entorno de prueba con fines académicos y no constituyen transacciones financieras reales.',
  },
  {
    titulo: '5. Reservas',
    cuerpo:
      'Las reservas de clases y canchas están sujetas a disponibilidad de cupo y a las políticas de cancelación vigentes en cada sede. El sistema prioriza el acceso equitativo mediante lista de espera cuando corresponde.',
  },
  {
    titulo: '6. Datos personales',
    cuerpo:
      'Los datos ingresados (nombre, DNI, contacto, foto de perfil) se utilizan exclusivamente para la operación de la plataforma. No se comparten con terceros fuera del alcance de este proyecto académico.',
  },
  {
    titulo: '7. Modificaciones',
    cuerpo:
      'Estos términos pueden actualizarse. El uso continuado de la plataforma tras una modificación implica la aceptación de los nuevos términos.',
  },
  {
    titulo: '8. Contacto',
    cuerpo:
      'Para consultas sobre estos términos, contactar a fitzonesports@gmail.com',
  },
];

export function TerminosCondiciones() {
  return (
    <>
      <PageHeading
        title="Términos y"
        accent="Condiciones."
        description="Las reglas de uso de la plataforma FitZone Sports."
      />
      <section className="mx-auto max-w-3xl px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="space-y-4">
          {SECCIONES.map((s) => (
            <article
              key={s.titulo}
              className="rounded-[1.75rem] border border-black/8 bg-white p-6 sm:p-8"
            >
              <h2 className="text-lg font-extrabold tracking-[-0.025em]">{s.titulo}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-black/60">{s.cuerpo}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
