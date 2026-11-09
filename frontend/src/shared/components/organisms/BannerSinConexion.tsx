import { WifiOff } from 'lucide-react';
import { useEstadoConexion } from '../../hooks/useEstadoConexion';

// Aviso discreto, montado una sola vez en la raíz. Desaparece solo al volver la red.
export function BannerSinConexion() {
  const online = useEstadoConexion();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 'var(--z-toast)',
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 8,
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 12,
        textAlign: 'center',
        color: 'var(--text)',
        background: 'var(--layer)',
        borderBottom: '1px solid var(--coral)',
      }}
    >
      <WifiOff size={15} aria-hidden style={{ color: 'var(--coral)', flexShrink: 0 }} />
      <span>Sin conexión a internet. Algunas funciones no están disponibles hasta que vuelvas a conectarte.</span>
    </div>
  );
}
