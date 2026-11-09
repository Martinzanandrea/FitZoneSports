import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../../modules/auth/AuthContext';
import { useModoStandalone } from '../../hooks/useModoStandalone';
import { destinoInicioApp } from '../../utils/rutaPanel';
import { BotonInstalar } from './BotonInstalar';
import { BotonVolverApp } from './BotonVolverApp';
import '../../../styles/publico.css';

// Estructura pública (barra, drawer, pie, encabezados y CTA) con el estilo
// lima/aqua "liquid glass" del resto de la app. Sin datos propios: todo
// lo que se muestra viene de la API o de textos ya existentes en el repo.

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path
        d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function Brand() {
  const standalone = useModoStandalone();
  const { user } = useAuth();
  // Instalada, la marca nunca lleva a la landing: va al panel (con sesión) o al login.
  const destino = standalone ? destinoInicioApp(user?.tipoActor) : '/';
  return (
    <Link aria-label="FitZone Sports, inicio" className="lp-brand" to={destino}>
      <span aria-hidden="true" className="lp-brand-mark">
        FZ
      </span>
      <span aria-hidden="true">
        FITZONE <b>SPORTS</b>
      </span>
    </Link>
  );
}

const LINKS = [
  { label: 'Inicio', to: '/' },
  { label: 'Clases', to: '/clases' },
  { label: 'Canchas', to: '/canchas' },
  { label: 'Sedes', to: '/sedes' },
  { label: 'Nosotros', to: '/nosotros' },
];

export function SiteHeader() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  const tab = abierto ? 0 : -1;
  const cerrar = () => setAbierto(false);

  return (
    <>
      <header className="lp-header glass">
        <Brand />
        <nav aria-label="Navegación principal" className="lp-nav">
          {LINKS.map((l) => (
            <NavLink end={l.to === '/'} key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="lp-actions">
          <BotonInstalar variante="landing" className="lp-hide-sm" />
          <Link className="lp-btn lp-btn-secondary lp-btn-sm lp-hide-sm" to="/login">
            Ingresar
          </Link>
          <Link className="lp-btn lp-btn-primary lp-btn-sm lp-hide-sm" to="/registro">
            Registrarme
          </Link>
          <button
            aria-controls="lp-drawer"
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="lp-burger"
            onClick={() => setAbierto((v) => !v)}
            type="button"
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        aria-hidden="true"
        className={`lp-overlay ${abierto ? 'is-open' : ''}`}
        onClick={() => setAbierto(false)}
      />
      <aside
        aria-label="Menú"
        className={`lp-drawer ${abierto ? 'is-open' : ''}`}
        id="lp-drawer"
        inert={!abierto}
      >
        <div className="lp-drawer-top">
          <Brand />
          <button
            aria-label="Cerrar menú"
            className="lp-burger"
            onClick={() => setAbierto(false)}
            tabIndex={tab}
            type="button"
          >
            <span style={{ transform: 'translateY(3.5px) rotate(45deg)' }} />
            <span style={{ transform: 'translateY(-3.5px) rotate(-45deg)' }} />
          </button>
        </div>
        <nav aria-label="Navegación móvil">
          {LINKS.map((l) => (
            <NavLink end={l.to === '/'} key={l.to} onClick={cerrar} to={l.to}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="lp-drawer-cta">
          <BotonInstalar variante="landing" />
          <Link className="lp-btn lp-btn-secondary" onClick={cerrar} to="/login">
            Ingresar
          </Link>
          <Link className="lp-btn lp-btn-primary" onClick={cerrar} to="/registro">
            Registrarme
          </Link>
        </div>
      </aside>
    </>
  );
}

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-grid">
        <div>
          <Brand />
          <p style={{ marginTop: 14, maxWidth: 360, fontSize: 14 }}>
            Espacios, personas y experiencias para que moverte sea una parte real de tu vida.
          </p>
        </div>
        <div>
          <h2>Explorar</h2>
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Tu cuenta</h2>
          <ul>
            <li>
              <Link to="/login">Ingresar</Link>
            </li>
            <li>
              <Link to="/registro">Registrarme</Link>
            </li>
            <li>
              <Link to="/terminos">Términos y Condiciones</Link>
            </li>
            <li>
              <a href="mailto:fitzonesports@gmail.com">fitzonesports@gmail.com</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="lp-wrap lp-footer-bottom">
        <span>© {new Date().getFullYear()} FitZone Sports</span>
        <span>Entrená. Jugá. Sentite parte.</span>
      </div>
    </footer>
  );
}

// Estructura común de toda página pública: ambiente, barra, contenido y pie.
export function PublicShell({ children }: { children: ReactNode }) {
  const standalone = useModoStandalone();
  // Instalada, las páginas públicas que quedan (términos, 404) van sin barra ni pie de la web.
  if (standalone) {
    return (
      <div className="lp-shell">
        <div aria-hidden="true" className="ambient ambient-lime" />
        <div aria-hidden="true" className="ambient ambient-aqua" />
        <div aria-hidden="true" className="ambient ambient-coral" />
        <header className="lp-header glass" style={{ justifyContent: 'flex-start' }}>
          <BotonVolverApp />
          <Brand />
        </header>
        <main className="lp-main" id="contenido" tabIndex={-1}>
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className="lp-shell">
      <a className="lp-skip" href="#contenido">
        Saltar al contenido
      </a>
      <div aria-hidden="true" className="ambient ambient-lime" />
      <div aria-hidden="true" className="ambient ambient-aqua" />
      <div aria-hidden="true" className="ambient ambient-coral" />
      <SiteHeader />
      <main className="lp-main" id="contenido" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function PageHeading({
  title,
  accent,
  description,
  eyebrow = 'Catálogo',
}: {
  title: string;
  accent: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <section className="lp-wrap lp-section" style={{ paddingBottom: 'clamp(24px, 5vw, 48px)' }}>
      <div className="lp-head" style={{ marginBottom: 0 }}>
        <span className="lp-eyebrow">{eyebrow}</span>
        <h1 className="lp-h1">
          {title} <em>{accent}</em>
        </h1>
        <p className="lp-lead">{description}</p>
      </div>
    </section>
  );
}

export function RegisterCta({
  copy,
  to = '/registro',
  ctaLabel = 'Crear mi cuenta',
  footnote,
}: {
  copy: string;
  to?: string;
  ctaLabel?: string;
  footnote?: string;
}) {
  return (
    <section className="lp-wrap">
      <div className="lp-cta glass">
        <span className="lp-eyebrow">Empezá hoy</span>
        <h2 className="lp-h2">{copy}</h2>
        <div className="lp-cta-row">
          <Link className="lp-btn lp-btn-primary" to={to}>
            {ctaLabel}
            <ArrowIcon />
          </Link>
        </div>
        {footnote && <p className="lp-foot-note">{footnote}</p>}
      </div>
    </section>
  );
}
