import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { useInstalacion } from "../../hooks/useInstalacion";
import "../../../styles/instalacion.css";

interface Props {
  // 'landing' usa los botones de la web pública; 'panel' los del panel.
  variante: "landing" | "panel";
  className?: string;
}

// Botón "Instalar aplicación". En Chrome y Edge dispara el prompt del navegador; en Safari de
// iPhone y iPad abre un cuadro con los pasos. No muestra nada si ya corre instalada o si el
// navegador no admite la instalación.
export function BotonInstalar({ variante, className = "" }: Props) {
  const { modo, instalar } = useInstalacion();
  const [pasos, setPasos] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pasos) return;
    cerrarRef.current?.focus();
    const alEscape = (e: KeyboardEvent) =>
      e.key === "Escape" && setPasos(false);
    document.addEventListener("keydown", alEscape);
    return () => document.removeEventListener("keydown", alEscape);
  }, [pasos]);

  if (!modo) return null;

  const base =
    variante === "landing"
      ? "lp-btn lp-btn-secondary lp-btn-sm"
      : "btn btn-secondary";

  return (
    <>
      <button
        type="button"
        className={`${base} ${className}`.trim()}
        style={{ minHeight: 44 }}
        onClick={() => (modo === "prompt" ? void instalar() : setPasos(true))}
      >
        <Download size={16} aria-hidden /> Instalar aplicación
      </button>

      {pasos && (
        <div
          className="instalar-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setPasos(false)}
        >
          <div
            className="instalar-card glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="instalar-titulo"
          >
            <button
              ref={cerrarRef}
              type="button"
              className="icon-button instalar-cerrar"
              aria-label="Cerrar"
              onClick={() => setPasos(false)}
            >
              <X size={18} aria-hidden />
            </button>
            <h2 id="instalar-titulo">Instalar FitZone Sports</h2>
            <ol>
              <li>Tocá Compartir en la barra de Safari.</li>
              <li>Elegí Agregar a pantalla de inicio.</li>
              <li>Confirmá con Agregar y abrí FitZone desde el ícono.</li>
            </ol>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 44, width: "100%" }}
              onClick={() => setPasos(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
