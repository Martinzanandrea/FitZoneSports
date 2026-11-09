import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { usePosicionFlotante } from '../../hooks/usePosicionFlotante';

export interface OpcionSelect {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  disabled?: boolean;
  /** Etiqueta accesible cuando no hay <label> visible (reemplaza al aria-label del select nativo). */
  ariaLabel?: string;
  /** Participa en la validación nativa del formulario (reemplaza al required del select nativo). */
  required?: boolean;
}

// Dropdown propio con el lenguaje visual de la app (el popup del
// <select> nativo lo pinta el navegador/SO y no se puede restylear).
// Cierra con click afuera, Escape o Tab; navegable con flechas + Enter.
// La lista va en un portal sobre document.body con position: fixed: así no la
// recortan ni la tapan los contextos de apilamiento (.glass) ni los overflow.
export function Select({ value, onChange, opciones, placeholder, disabled, ariaLabel, required }: SelectProps) {
  const [abierto, setAbierto] = useState(false);
  const [destacado, setDestacado] = useState(0);
  const raizRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const pos = usePosicionFlotante(abierto, botonRef, listaRef, { modo: 'lista' });

  // El placeholder "" cuenta como primera opción elegible, igual que el
  // <option value=""> del select nativo que reemplaza.
  const items: OpcionSelect[] = placeholder !== undefined
    ? [{ value: '', label: placeholder }, ...opciones]
    : opciones;
  const indiceActual = items.findIndex((o) => o.value === value);
  const etiqueta = indiceActual >= 0 ? items[indiceActual].label : placeholder ?? '';

  useEffect(() => {
    if (!abierto) return;
    function alClickAfuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      if (raizRef.current && !raizRef.current.contains(objetivo) && !listaRef.current?.contains(objetivo)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !listaRef.current) return;
    const activo = listaRef.current.querySelector<HTMLElement>(`[data-indice="${destacado}"]`);
    activo?.scrollIntoView({ block: 'nearest' });
  }, [abierto, destacado]);

  function abrir() {
    if (disabled) return;
    setDestacado(indiceActual >= 0 ? indiceActual : 0);
    setAbierto(true);
  }

  function elegir(op: OpcionSelect) {
    if (op.disabled) return;
    onChange(op.value);
    setAbierto(false);
  }

  function alTeclado(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      abrir();
      return;
    }
    if (!abierto) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // no cierra además el modal/panel que contiene al select
      setAbierto(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestacado((i) => {
        let siguiente = i;
        for (let n = 0; n < items.length; n++) {
          siguiente = (siguiente + 1) % items.length;
          if (!items[siguiente].disabled) break;
        }
        return siguiente;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestacado((i) => {
        let anterior = i;
        for (let n = 0; n < items.length; n++) {
          anterior = (anterior - 1 + items.length) % items.length;
          if (!items[anterior].disabled) break;
        }
        return anterior;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      elegir(items[destacado]);
    } else if (e.key === 'Tab') {
      setAbierto(false);
    }
  }

  return (
    <div ref={raizRef} className="relative w-full">
      <button
        ref={botonRef}
        type="button"
        role="combobox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclado}
        className={`flex w-full items-center justify-between gap-2 rounded-[11px] border bg-layer-2 px-3 py-2.5 text-left text-[11px] outline-none transition-colors ${
          abierto ? 'border-lime ring-2 ring-lime/20' : 'border-white/10 focus:border-lime'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
          value === '' && placeholder !== undefined ? 'text-mist' : 'text-ink'
        }`}
        style={{ minHeight: 44 }}
      >
        <span className="truncate">{etiqueta}</span>
        <ChevronDown size={16} className={`shrink-0 text-mist transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {required && (
        <input
          required
          value={value}
          onChange={() => {}}
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}
      {abierto && createPortal(
        <div
          ref={listaRef}
          role="listbox"
          className="overflow-y-auto rounded-xl border border-white/15 bg-[#0e2b2f] p-1.5 shadow-[0_16px_35px_-12px_rgba(0,0,0,0.6)]"
          style={{
            position: 'fixed',
            zIndex: 'var(--z-popover)',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            width: pos?.width,
            maxHeight: pos?.maxHeight ?? 240,
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {items.map((op, i) => {
            const seleccionada = op.value === value;
            return (
              <button
                key={`${op.value}-${i}`}
                type="button"
                role="option"
                aria-selected={seleccionada}
                data-indice={i}
                disabled={op.disabled}
                onClick={() => elegir(op)}
                onMouseEnter={() => setDestacado(i)}
                className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  op.disabled
                    ? 'cursor-not-allowed text-mist/60'
                    : seleccionada
                      ? 'bg-lime/15 font-semibold text-ink'
                      : i === destacado
                        ? 'bg-white/[0.06] text-ink'
                        : 'text-mist hover:bg-white/[0.06]'
                }`}
                style={{ minHeight: 44 }}
              >
                <span className="truncate">{op.label}</span>
                {seleccionada && <Check size={16} className="shrink-0 text-lime" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
