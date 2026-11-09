import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { ScrollToTop } from './routes/ScrollToTop';
import { AvisoActualizacion, BannerCookies, BannerSinConexion } from './shared/components/organisms';;

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <div aria-hidden className="ambient ambient-lime" />
        <div aria-hidden className="ambient ambient-aqua" />
        <div aria-hidden className="ambient ambient-coral" />
        <AppRoutes />
        <BannerCookies />
        <BannerSinConexion />
        <AvisoActualizacion />
        <Analytics />
      </AuthProvider>
    </BrowserRouter>
  );
}