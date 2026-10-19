import { useState } from 'react';
import { Link } from 'react-router-dom';

const CLAVE = 'cookiesAceptadas';

export function BannerCookies() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(CLAVE) !== 'true';
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  function aceptar() {
    try {
      localStorage.setItem(CLAVE, 'true');
    } catch {
      // Sin almacenamiento disponible, igual se oculta en esta sesión.
    }
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10"
      style={{ zIndex: 'var(--z-popover)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-white/70 leading-relaxed">
          Usamos cookies esenciales para mantener tu sesión iniciada.{' '}
          <Link to="/terminos" className="font-semibold text-white underline hover:text-lime">
            Ver términos
          </Link>
        </p>
        <button
          type="button"
          onClick={aceptar}
          className="shrink-0 rounded-lg bg-lime px-5 py-2.5 text-sm font-bold text-bg hover:brightness-110 transition-all"
          style={{ minHeight: 44, color: '#071a1d' }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
