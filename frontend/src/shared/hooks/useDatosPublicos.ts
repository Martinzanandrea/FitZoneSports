import { useCallback, useEffect, useState } from 'react';

// Carga un endpoint público y expone loading / error / reintento.
export function useDatosPublicos<T>(cargar: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    cargar()
      .then((res) => activo && setData(res))
      .catch(() => activo && setError(true))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
    // `cargar` es una función estable del módulo api; el reintento la vuelve a disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento]);

  const reintentar = useCallback(() => {
    setCargando(true);
    setError(false);
    setIntento((n) => n + 1);
  }, []);
  return { data, cargando, error, reintentar };
}
