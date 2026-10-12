import { useEffect, useState } from 'react';

// Reloj para el render: devuelve el instante actual (ms desde epoch) y lo
// refresca cada `intervaloMs`. Evita llamar a Date.now() durante el render.
export function useAhora(intervaloMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);

  return ahora;
}
