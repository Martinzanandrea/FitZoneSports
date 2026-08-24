import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { Layout } from '../shared/components/Layout';
import { Login } from '../modules/auth/pages/Login';

function Home() {
  return <h1>Bienvenido a FitZone Sports</h1>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        {/* acá se van a ir agregando las rutas de cada módulo:
            /clases, /canchas, /membresias, /pagos, /acceso, /usuarios */}
      </Route>
    </Routes>
  );
}