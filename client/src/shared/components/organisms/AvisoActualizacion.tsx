import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEstadoConexion } from '../../hooks/useEstadoConexion';

// Aviso discreto cuando hay una versión nueva de la app. El usuario decide cuándo
// actualizar: el service worker nuevo queda en espera hasta que toca "Actualizar".
export function AvisoActualizacion() {
  const {
    needRefresh: [hayNuevaVersion, setHayNuevaVersion],
    updateServiceWorker,
  } = useRegisterSW();

  const online = useEstadoConexion();

  if (!hayNuevaVersion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass"
      style={{
        position: 'fixed',
        // Con el banner de sin conexión arriba, el aviso baja para no taparlo.
        top: online ? 'max(12px, env(safe-area-inset-top))' : 'calc(max(8px, env(safe-area-inset-top)) + 52px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast)',
        width: 'min(420px, calc(100vw - 24px))',
        padding: '12px 14px',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        background: 'var(--layer)',
        border: '1px solid var(--line)',
        boxShadow: '0 18px 50px rgba(0, 0, 0, 0.4)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text)' }}>Hay una nueva versión disponible</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setHayNuevaVersion(false)}>
          Más tarde
        </button>
        {/* true: al activar el service worker nuevo, la página se recarga. */}
        <button type="button" className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </button>
      </span>
    </div>
  );
}
