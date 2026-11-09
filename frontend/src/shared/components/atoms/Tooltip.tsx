import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePosicionFlotante } from '../../hooks/usePosicionFlotante';

// Átomo: ayuda contextual para personal con poca capacitación: muestra el texto
// al pasar el mouse (desktop) o al tocar el ícono (mobile/tablet).
export function Tooltip({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  const [visible, setVisible] = useState(false);
  const anclaRef = useRef<HTMLSpanElement>(null);
  const globoRef = useRef<HTMLSpanElement>(null);
  const pos = usePosicionFlotante(visible, anclaRef, globoRef, { modo: 'tooltip', altoMaximo: 200, separacion: 8 });

  // Escape cierra el tooltip (el globo está en un portal, fuera del contenedor).
  useEffect(() => {
    if (!visible) return;
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setVisible(false);
    }
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [visible]);

  return (
    <span
      ref={anclaRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onTouchStart={() => setVisible((v) => !v)}
    >
      {children}
      {visible && createPortal(
        <span
          ref={globoRef}
          role="tooltip"
          className="pointer-events-none w-max max-w-[220px] rounded-lg border border-white/15 bg-[#0a1f22] px-3 py-2 text-xs text-ink shadow-lg"
          style={{
            position: 'fixed',
            zIndex: 'var(--z-popover)',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
