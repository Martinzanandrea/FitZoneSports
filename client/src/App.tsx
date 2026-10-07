import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { BannerCookies } from './shared/components/BannerCookies';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div aria-hidden className="ambient ambient-lime" />
        <div aria-hidden className="ambient ambient-aqua" />
        <div aria-hidden className="ambient ambient-coral" />
        <AppRoutes />
        <BannerCookies />
      </AuthProvider>
    </BrowserRouter>
  );
}