import { useEffect, useState } from 'react';
import { esRuidoDelNavegador, mensajeDeErrorInesperado } from '../../utils/errores';

// Errores fuera del render de React (eventos, promesas sin capturar, timers): el ErrorBoundary
// no los ve. En vez de dejar la pantalla rota sin explicación, se muestra el mensaje.
export function AvisoErroresGlobales() {
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    const alError = (e: ErrorEvent) => {
      const texto = mensajeDeErrorInesperado(e.error ?? e.message);
      if (esRuidoDelNavegador(texto)) return;
      console.error('[error global]', e.error ?? e.message);
      setMensaje(texto);
    };
    const alRechazo = (e: PromiseRejectionEvent) => {
      const texto = mensajeDeErrorInesperado(e.reason);
      if (esRuidoDelNavegador(texto)) return;
      console.error('[promesa rechazada sin capturar]', e.reason);
      setMensaje(texto);
    };
    window.addEventListener('error', alError);
    window.addEventListener('unhandledrejection', alRechazo);
    return () => {
      window.removeEventListener('error', alError);
      window.removeEventListener('unhandledrejection', alRechazo);
    };
  }, []);

  if (!mensaje) return null;
  return (
    <div
      role="alert"
      className="notice notice-err"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <strong>Ocurrió un error inesperado</strong>
      <span style={{ fontSize: 11, overflowWrap: 'anywhere' }}>{mensaje}</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setMensaje(null)}>
          Cerrar
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </span>
    </div>
  );
}
