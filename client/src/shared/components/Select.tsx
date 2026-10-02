import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
export function Select({ value, onChange, opciones, placeholder, disabled, ariaLabel, required }: SelectProps) {
  const [abierto, setAbierto] = useState(false);
  const [destacado, setDestacado] = useState(0);
  const raizRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

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
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, [abierto ]);

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
        type="button"
        role="combobox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclado}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-sm outline-none transition-colors ${
          abierto ? 'border-[#8B2EFF] ring-2 ring-[#8B2EFF]/20' : 'border-[#E5E7EB] focus:border-[#8B2EFF]'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
          value === '' && placeholder !== undefined ? 'text-[#9CA3AF]' : 'text-[#111111]'
        }`}
        style={{ minHeight: 44 }}
      >
        <span className="truncate">{etiqueta}</span>
        <ChevronDown size={16} className={`shrink-0 text-[#6B7280] transition-transform ${abierto ? 'rotate-180' : ''}`} />
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
      {abierto && (
        <div
          ref={listaRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_16px_35px_-22px_rgba(139,46,255,0.55)]"
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
                    ? 'cursor-not-allowed text-[#9CA3AF]'
                    : seleccionada
                      ? 'bg-[#F3E8FF] font-semibold text-[#111111]'
                      : i === destacado
                        ? 'bg-[#F3E8FF]/60 text-[#111111]'
                        : 'text-[#374151] hover:bg-[#F3E8FF]/60'
                }`}
                style={{ minHeight: 44 }}
              >
                <span className="truncate">{op.label}</span>
                {seleccionada && <Check size={16} className="shrink-0 text-[#8B2EFF]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
