import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

//scroll 0,0 al hacer cambio de ruta
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
