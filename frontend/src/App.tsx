import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { ScrollToTop } from './routes/ScrollToTop';
import { AvisoActualizacion, AvisoErroresGlobales, BannerCookies, BannerSinConexion, ErrorBoundary } from './shared/components/organisms';;

// Dentro del Router para reiniciar el boundary al cambiar de ruta.
function RutasConBoundary() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <AppRoutes />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <div aria-hidden className="ambient ambient-lime" />
        <div aria-hidden className="ambient ambient-aqua" />
        <div aria-hidden className="ambient ambient-coral" />
        <RutasConBoundary />
        <AvisoErroresGlobales />
        <BannerCookies />
        <BannerSinConexion />
        <AvisoActualizacion />
        <Analytics />
      </AuthProvider>
    </BrowserRouter>
  );
}