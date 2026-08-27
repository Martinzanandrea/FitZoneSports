import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { Layout } from '../shared/components/Layout';
import { AdminLayout } from '../shared/components/AdminLayout';
import { Login } from '../modules/auth/pages/Login';
import { Inicio } from '../modules/inicio/pages/Inicio';
import { AdminIndex } from '../modules/admin/AdminIndex';
import { GerenteDashboard } from '../modules/admin/pages/GerenteDashboard';
import { RecepcionistaDashboard } from '../modules/admin/pages/RecepcionistaDashboard';
import { CrearStaff } from '../modules/usuarios/pages/CrearStaff';
import { TipoActor } from '../shared/types/enums';

function Dashboard() {
  return <h1>Bienvenido a FitZone Sports</h1>;
}

function RegistroPlaceholder() {
  return <h1>Registro (próximamente)</h1>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/registro" element={<RegistroPlaceholder />} />

      <Route path="/login" element={<Login audience="cliente" redirectTo="/dashboard" />} />
      <Route path="/admin/login" element={<Login audience="staff" redirectTo="/admin" />} />

      <Route
        element={
          <ProtectedRoute loginPath="/login">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute
            allowedRoles={[TipoActor.GERENTE, TipoActor.RECEPCIONISTA]}
            loginPath="/admin/login"
            fallbackPath="/login"
          >
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminIndex />} />
        <Route
          path="gerente"
          element={
            <ProtectedRoute allowedRoles={[TipoActor.GERENTE]} loginPath="/admin/login">
              <GerenteDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="recepcion"
          element={
            <ProtectedRoute allowedRoles={[TipoActor.RECEPCIONISTA]} loginPath="/admin/login">
              <RecepcionistaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="personal"
          element={
            <ProtectedRoute allowedRoles={[TipoActor.GERENTE]} loginPath="/admin/login">
              <CrearStaff />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}