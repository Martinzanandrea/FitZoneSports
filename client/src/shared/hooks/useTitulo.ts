import { useEffect } from 'react';

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} | FitZone Sports`;
    return () => {
      document.title = 'FitZone Sports';
    };
  }, [titulo]);
}
