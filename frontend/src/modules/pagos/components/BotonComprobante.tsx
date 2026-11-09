import { useState } from 'react';
import { FileText } from 'lucide-react';
import { pagosApi } from '../pagos.api';

// Abre el PDF de un comprobante por el endpoint con control de acceso
// (GET /comprobantes/:id/archivo), no por la URL pública del bucket.
// La pestaña se abre en el clic (antes del pedido) para que el navegador no la
// bloquee como pop-up, y se completa cuando llega el archivo.
export function BotonComprobante({
  comprobanteId,
  etiqueta = 'Ver comprobante',
  className = 'btn btn-ghost',
  ariaLabel,
}: {
  comprobanteId: string;
  etiqueta?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  async function abrir() {
    setError(false);
    setCargando(true);
    const ventana = window.open('', '_blank');
    try {
      const blob = await pagosApi.getArchivoComprobante(comprobanteId);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
      // El visor ya tiene el archivo cargado pasado un rato.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      ventana?.close();
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={{ minHeight: 44, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        onClick={() => void abrir()}
        disabled={cargando}
        aria-label={ariaLabel ?? etiqueta}
      >
        <FileText size={15} aria-hidden />
        {cargando ? 'Abriendo…' : etiqueta}
      </button>
      {error && (
        <span role="alert" style={{ color: 'var(--coral)', fontSize: 11 }}>
          No se pudo abrir el comprobante.
        </span>
      )}
    </>
  );
}
