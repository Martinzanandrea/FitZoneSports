import { Link, useLocation } from 'react-router-dom';

// Primitivos visuales portados del diseño Figma Make (solo estructura,
// sin datos mock). El router por hash del mock se reemplaza por React
// Router real: <Link> y useLocation() para la página activa.

export function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 transition-transform duration-300 group-hover:translate-x-1"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      className="flex items-center gap-2.5 text-base font-black tracking-[-0.04em] sm:text-lg"
      to="/"
    >
      <span className="grid size-8 place-items-center rounded-full bg-[#8B2EFF] text-sm text-white">
        FZ
      </span>
      <span className={dark ? 'text-white' : 'text-black'}>
        FITZONE<span className="text-[#8B2EFF]">SPORTS</span>
      </span>
    </Link>
  );
}

type LandingPage = 'inicio' | 'clases' | 'canchas' | 'sedes' | 'nosotros';

function paginaActiva(pathname: string): LandingPage | null {
  if (pathname === '/') return 'inicio';
  if (pathname.startsWith('/clases')) return 'clases';
  if (pathname.startsWith('/canchas')) return 'canchas';
  if (pathname.startsWith('/sedes')) return 'sedes';
  if (pathname.startsWith('/nosotros')) return 'nosotros';
  return null;
}

const LINKS: { label: string; to: string; value: LandingPage }[] = [
  { label: 'Inicio', to: '/', value: 'inicio' },
  { label: 'Clases', to: '/clases', value: 'clases' },
  { label: 'Canchas', to: '/canchas', value: 'canchas' },
  { label: 'Sedes', to: '/sedes', value: 'sedes' },
  { label: 'Nosotros', to: '/nosotros', value: 'nosotros' },
];

export function SiteHeader() {
  const { pathname } = useLocation();
  const page = paginaActiva(pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-black/7 bg-[#FAFAFA]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Brand />
        <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                page === link.value
                  ? 'bg-black text-white'
                  : 'text-black/55 hover:bg-black/5 hover:text-black'
              }`}
              key={link.value}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            className="hidden px-2 py-2 text-sm font-bold transition-colors hover:text-[#8B2EFF] sm:block"
            to="/login"
          >
            Iniciar sesión
          </Link>
          <Link
            className="rounded-full bg-[#8B2EFF] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#7720E6] sm:text-sm"
            to="/registro"
          >
            Registrarme
          </Link>
        </div>
      </div>
      <nav
        aria-label="Navegación móvil"
        className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-5 pb-3 md:hidden"
      >
        {LINKS.map((link) => (
          <Link
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              page === link.value ? 'bg-black text-white' : 'bg-black/4 text-black/55'
            }`}
            key={link.value}
            to={link.to}
          >
            {link.label}
          </Link>
        ))}
        <Link className="ml-auto shrink-0 px-2 text-xs font-bold sm:hidden" to="/login">
          Ingresar
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
        <div className="md:col-span-2">
          <Brand dark />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/45">
            Espacios, personas y experiencias para que moverte sea una parte real de
            tu vida.
          </p>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/35">
            Explorar
          </p>
          <div className="flex flex-col gap-3 text-sm font-semibold">
            <Link className="hover:text-[#B980FF]" to="/">
              Inicio
            </Link>
            <Link className="hover:text-[#B980FF]" to="/clases">
              Clases grupales
            </Link>
            <Link className="hover:text-[#B980FF]" to="/canchas">
              Canchas deportivas
            </Link>
            <Link className="hover:text-[#B980FF]" to="/sedes">
              Sedes
            </Link>
            <Link className="hover:text-[#B980FF]" to="/nosotros">
              Nosotros
            </Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/35">
            Contacto
          </p>
          <div className="space-y-3 text-sm text-white/65">
            <p>hola@fitzonesports.com</p>
            <p>Lun a vie · 7 a 22 h</p>
            <p>Buenos Aires, Argentina</p>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 px-5 py-6 text-xs text-white/30 sm:flex-row sm:justify-between sm:px-8 lg:px-12">
        <p>© 2025 FitZoneSports</p>
        <p>Entrená. Jugá. Sentite parte.</p>
      </div>
    </footer>
  );
}

export function PageHeading({
  title,
  accent,
  description,
}: {
  title: string;
  accent: string;
  description: string;
}) {
  return (
    <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:px-12">
      <div
        aria-hidden="true"
        className="absolute -right-44 -top-20 size-[32rem] rounded-full bg-[#8B2EFF]/10 blur-3xl"
      />
      <div className="relative">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#8B2EFF]/20 bg-[#8B2EFF]/8 px-3.5 py-2 text-[11px] font-extrabold tracking-[0.18em] text-[#7119DE]">
          <span className="size-1.5 rounded-full bg-[#8B2EFF]" />
          CATÁLOGO
        </div>
        <h1 className="max-w-5xl text-[clamp(3.5rem,10vw,7.5rem)] font-black leading-[0.86] tracking-[-0.075em]">
          {title}
          <br />
          <span className="text-[#8B2EFF]">{accent}</span>
        </h1>
        <p className="mt-9 max-w-2xl border-l-2 border-[#8B2EFF] pl-5 text-lg leading-relaxed text-black/60 sm:mt-12 sm:pl-7 sm:text-xl">
          {description}
        </p>
      </div>
    </section>
  );
}

export function RegisterCta({
  copy,
  to = '/registro',
  ctaLabel = 'Crear mi cuenta',
  footnote = 'Crear tu cuenta es gratis. Elegís cuándo empezar.',
}: {
  copy: string;
  to?: string;
  ctaLabel?: string;
  footnote?: string;
}) {
  return (
    <section className="bg-[#FAFAFA] px-3 py-3 sm:px-5 sm:py-5">
      <div className="relative mx-auto max-w-[92rem] overflow-hidden rounded-[2rem] bg-[#0A0A0A] px-5 py-20 text-center text-white sm:px-10 sm:py-28">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8B2EFF]/40 blur-[100px] sm:size-[34rem]"
        />
        <div className="relative mx-auto max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
            Empezá hoy
          </span>
          <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            {copy}
          </h2>
          <Link
            className="group mx-auto mt-9 flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-[#8B2EFF] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#7720E6]"
            to={to}
          >
            {ctaLabel}
            <ArrowIcon />
          </Link>
          <p className="mt-4 text-xs text-white/35">
            {footnote}
          </p>
        </div>
      </div>
    </section>
  );
}
