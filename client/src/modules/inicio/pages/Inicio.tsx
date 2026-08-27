import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Dumbbell,
  Users,
  MapPin,
  QrCode,
  ArrowRight,
  Quote,
  Plus,
  Minus,
  Share2,
  AtSign,
  Globe,
} from 'lucide-react';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { Reveal } from '../../../shared/components/Reveal';

const SERVICIOS = [
  { icon: Users, title: 'Clases grupales', description: 'Yoga, spinning, crossfit y más. Reservá tu lugar en segundos desde la app.' },
  { icon: MapPin, title: 'Canchas deportivas', description: 'Paddle, fútbol 5 y más. Consultá disponibilidad y reservá al instante.' },
  { icon: QrCode, title: 'Acceso multi-sede', description: 'Un solo abono te da acceso a todas las sedes. Ingresá con QR.' },
];

const CLASES = [
  { title: 'Spinning', description: 'Indoor cycling de alta intensidad con ritmo, música y energía al máximo.' },
  { title: 'Yoga', description: 'Encontrá el equilibrio perfecto entre flexibilidad, fuerza y mindfulness.' },
  { title: 'Funcional', description: 'Circuito de fuerza y resistencia diseñado para potenciar tu rendimiento diario.' },
];

const STATS = [
  { value: '25+', label: 'Sedes equipadas' },
  { value: '10K', label: 'Socios activos' },
  { value: '50+', label: 'Clases semanales' },
  { value: '98%', label: 'Satisfacción total' },
];

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

export function Inicio() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [faqAbierta, setFaqAbierta] = useState<number | null>(0);

  useEffect(() => {
    sedesApi.getAllPublico().then(setSedes).catch(() => setSedes([]));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header sticky con blur */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg bg-[#8B2EFF] w-8 h-8 shrink-0">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-sm">FitZone</span>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            <a href="#clases" className="text-sm text-white/60 hover:text-white transition-colors">Clases</a>
            <a href="#canchas" className="text-sm text-white/60 hover:text-white transition-colors">Canchas</a>
            <a href="#sedes" className="text-sm text-white/60 hover:text-white transition-colors">Sedes</a>
            <a href="#nosotros" className="text-sm text-white/60 hover:text-white transition-colors">Nosotros</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
              Ingresar
            </Link>
            <Link
              to="/registro"
              className="px-4 py-2 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold hover:bg-[#7A25E6] transition-all hover:scale-[1.02]"
            >
              Registrarme
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-[#0A0A0A] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <Reveal>
            <span className="inline-block px-3 py-1 rounded-full bg-[#8B2EFF]/10 border border-[#8B2EFF]/30 text-[#B794FF] text-[11px] font-semibold tracking-wide uppercase">
              Premium Fitness Club
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl font-extrabold text-white leading-[1.05] tracking-tight">
              ENTRENA<br />SIN <span className="text-[#8B2EFF]">LÍMITES</span>
            </h1>
            <p className="mt-4 text-white/50 text-base leading-relaxed max-w-md">
              Accedé a las mejores instalaciones de la ciudad, canchas reglamentarias
              con reserva inteligente y un equipo de profesionales dedicados a tu progreso.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/registro"
                className="px-6 py-3 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold
                  hover:bg-[#7A25E6] transition-all hover:scale-[1.02] flex items-center gap-2"
              >
                Empieza ahora <ArrowRight size={16} />
              </Link>
              <a href="#nosotros" className="px-6 py-3 rounded-lg border border-white/15 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                Ver más
              </a>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-[#8B2EFF]/30 via-[#0A0A0A] to-[#0A0A0A] border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80"
                alt="Entrenamiento en FitZone Sports"
                className="w-full h-full object-cover mix-blend-luminosity opacity-80"
              />
              <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-white text-[11px] font-medium">Sede Central abierta 24/7</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Qué ofrecemos */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[#F3E8FF] text-[#8B2EFF] text-[11px] font-semibold tracking-wide uppercase">
              Servicios
            </span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-[#111111]">Qué ofrecemos</h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
            {SERVICIOS.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <div className="group h-full p-6 rounded-2xl border border-[#E5E7EB] hover:border-[#8B2EFF] hover:shadow-lg hover:shadow-[#8B2EFF]/10 hover:-translate-y-1 transition-all duration-300">
                  <div className="w-11 h-11 rounded-xl bg-[#F3E8FF] group-hover:bg-[#8B2EFF] flex items-center justify-center mb-4 transition-colors duration-300">
                    <s.icon size={20} className="text-[#8B2EFF] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="font-semibold text-[#111111]">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-[#6B7280] leading-relaxed">{s.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Clases grupales */}
      <section id="clases" className="bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal>
            <div className="w-10 h-1 bg-[#8B2EFF] rounded-full mb-3" />
            <h2 className="text-2xl md:text-3xl font-bold text-[#111111]">Clases Grupales</h2>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {CLASES.map((c, i) => (
              <Reveal key={c.title} delay={i * 100}>
                <div className="rounded-2xl overflow-hidden bg-white border border-[#E5E7EB] h-full">
                  <div className="aspect-[16/10] bg-gradient-to-br from-[#8B2EFF]/20 to-[#0A0A0A]" />
                  <div className="p-5">
                    <h3 className="font-semibold text-[#111111]">{c.title}</h3>
                    <p className="mt-1.5 text-sm text-[#6B7280] leading-relaxed">{c.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 flex flex-col items-center gap-4">
            <span className="px-4 py-1.5 rounded-full bg-[#8B2EFF] text-white text-xs font-semibold">
              Reservá hasta 48hs antes
            </span>
            <Link
              to="/registro"
              className="w-full sm:w-auto px-8 py-3 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold text-center hover:bg-[#7A25E6] transition-all hover:scale-[1.02]"
            >
              Ver horarios
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Canchas deportivas */}
      <section id="canchas" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal>
            <div className="w-10 h-1 bg-[#8B2EFF] rounded-full mb-3" />
            <h2 className="text-2xl md:text-3xl font-bold text-[#111111]">Canchas Deportivas</h2>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { title: 'Paddle', description: 'Canchas de vidrio templado de última generación con iluminación LED profesional.' },
              { title: 'Fútbol 5', description: 'Césped sintético premium diseñado para proteger tus articulaciones y correr seguro.' },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 100}>
                <div className="rounded-2xl overflow-hidden bg-white border border-[#E5E7EB] h-full">
                  <div className="aspect-[16/9] bg-gradient-to-br from-[#0A0A0A] via-[#1a1030] to-[#8B2EFF]/30" />
                  <div className="p-5">
                    <h3 className="font-semibold text-[#111111]">{c.title}</h3>
                    <p className="mt-1.5 text-sm text-[#6B7280] leading-relaxed">{c.description}</p>
                    <span className="inline-block mt-3 px-2.5 py-1 rounded-md bg-[#F3E8FF] text-[#8B2EFF] text-xs font-semibold">
                      -15% para socios
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-[#6B7280]">
              Los turnos en horario pico (19 a 21hs) tienen un recargo del 15%.
            </p>
            <Link
              to="/registro"
              className="w-full sm:w-auto px-8 py-3 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold hover:bg-[#7A25E6] transition-all hover:scale-[1.02]"
            >
              Reservar cancha
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Sedes — DATOS REALES */}
      <section id="sedes" className="bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="text-center">
            <div className="w-10 h-1 bg-[#8B2EFF] rounded-full mb-3 mx-auto" />
            <h2 className="text-2xl md:text-3xl font-bold text-[#111111]">Nuestras Sedes</h2>
            <p className="mt-2 text-sm text-[#6B7280]">Accedé a cualquiera de nuestras sucursales con tu mismo abono</p>
          </Reveal>

          {sedes.length === 0 ? (
            <p className="mt-10 text-sm text-[#6B7280] text-center">Cargando sedes…</p>
          ) : (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sedes.map((sede, i) => (
                <Reveal key={sede.id} delay={i * 60}>
                  <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#8B2EFF] transition-colors duration-200">
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-[#8B2EFF] mt-0.5 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-[#111111] text-sm">{sede.nombre}</h3>
                        <p className="mt-0.5 text-xs text-[#6B7280]">{sede.direccion}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Nosotros / Stats */}
      <section id="nosotros" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <Reveal>
            <span className="text-[#8B2EFF] text-xs font-semibold tracking-wide uppercase">Nuestro propósito</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-[#111111] leading-tight">
              Redefiniendo el rendimiento
            </h2>
            <p className="mt-4 text-sm text-[#6B7280] leading-relaxed">
              En FitZone Sports creemos que el deporte no es solo rutina, sino un estilo de
              vida sin restricciones. Ofrecemos ecosistemas equipados con tecnología de
              análisis corporal, áreas de recuperación y comunidades activas que se apoyan
              mutuamente para alcanzar sus metas diarias.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 gap-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="p-5 rounded-2xl bg-[#FAFAFA] border border-[#E5E7EB]">
                  <p className="text-3xl font-extrabold text-[#8B2EFF]">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-[#6B7280] uppercase tracking-wide">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="text-center">
            <span className="text-[#8B2EFF] text-xs font-semibold tracking-wide uppercase">Nuestras experiencias</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-[#111111]">Lo que dicen nuestros socios</h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIOS.map((t, i) => (
              <Reveal key={t.nombre} delay={i * 100}>
                <div className="h-full p-6 rounded-2xl bg-white border border-[#E5E7EB]">
                  <Quote size={20} className="text-[#8B2EFF]/40" />
                  <p className="mt-3 text-sm text-[#374151] leading-relaxed">«{t.texto}»</p>
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                    <p className="text-sm font-semibold text-[#111111]">{t.nombre}</p>
                    <p className="text-xs text-[#6B7280]">{t.desde}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="text-center">
            <span className="text-[#8B2EFF] text-xs font-semibold tracking-wide uppercase">Resolvemos tus dudas</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-[#111111]">Preguntas frecuentes</h2>
          </Reveal>

          <div className="mt-8 space-y-3">
            {FAQS.map((f, i) => {
              const abierta = faqAbierta === i;
              return (
                <Reveal key={f.pregunta} delay={i * 60}>
                  <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
                    <button
                      onClick={() => setFaqAbierta(abierta ? null : i)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-[#111111]">{f.pregunta}</span>
                      {abierta ? (
                        <Minus size={16} className="text-[#8B2EFF] shrink-0" />
                      ) : (
                        <Plus size={16} className="text-[#6B7280] shrink-0" />
                      )}
                    </button>
                    <div
                      className={`grid transition-all duration-300 ${
                        abierta ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-sm text-[#6B7280] leading-relaxed">{f.respuesta}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative bg-[#0A0A0A] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20 text-center">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">
              Tu mejor versión <span className="text-[#8B2EFF]">empieza hoy</span>
            </h2>
            <Link
              to="/registro"
              className="inline-flex items-center gap-2 mt-7 px-8 py-3.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold
                hover:bg-[#7A25E6] transition-all hover:scale-[1.03]"
            >
              Registrarme gratis <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A0A0A] border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center rounded-lg bg-[#8B2EFF] w-7 h-7 shrink-0">
                <Zap size={14} className="text-white" fill="white" />
              </div>
              <span className="font-bold text-white text-sm">FitZone Sports</span>
            </div>
            <p className="mt-3 text-xs text-white/40 max-w-xs leading-relaxed">
              Tu destino definitivo para el desarrollo físico y técnico. Conexión directa
              con tu pasión deportiva.
            </p>
            <div className="flex items-center gap-3 mt-4">
               <AtSign size={16} className="text-white/40 hover:text-white transition-colors cursor-pointer" />
               <Share2 size={16} className="text-white/40 hover:text-white transition-colors cursor-pointer" />
                <Globe size={16} className="text-white/40 hover:text-white transition-colors cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-white text-xs font-semibold mb-3">Producto</p>
              <ul className="space-y-2 text-xs text-white/40">
                <li><a href="#clases" className="hover:text-white transition-colors">Clases</a></li>
                <li><a href="#canchas" className="hover:text-white transition-colors">Canchas</a></li>
                <li><a href="#sedes" className="hover:text-white transition-colors">Sedes</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-3">Empresa</p>
              <ul className="space-y-2 text-xs text-white/40">
                <li><a href="#nosotros" className="hover:text-white transition-colors">Nosotros</a></li>
                <li><span className="cursor-default">Contacto</span></li>
              </ul>
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-3">Legal</p>
              <ul className="space-y-2 text-xs text-white/40">
                <li><span className="cursor-default">Términos</span></li>
                <li><span className="cursor-default">Privacidad</span></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-white/30">© 2026 FitZone Sports. Todos los derechos reservados.</p>
            <p className="text-xs text-white/30">Hecho con pasión por el deporte.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}