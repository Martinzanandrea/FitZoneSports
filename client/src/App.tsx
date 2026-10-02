import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { BannerCookies } from './shared/components/BannerCookies';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <BannerCookies />
      </AuthProvider>
    </BrowserRouter>
  );
}