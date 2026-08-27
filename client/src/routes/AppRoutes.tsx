import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminLayout } from '../shared/components/AdminLayout';
import { Login } from '../modules/auth/pages/Login';
import { Inicio } from '../modules/inicio/pages/Inicio';
import { AdminIndex } from '../modules/admin/AdminIndex';
import { GerenteDashboard } from '../modules/admin/pages/GerenteDashboard';
import { RecepcionistaDashboard } from '../modules/admin/pages/RecepcionistaDashboard';
import { CrearStaff } from '../modules/usuarios/pages/CrearStaff';
import { TipoActor } from '../shared/types/enums';
import { SedesPage } from '../modules/sedes/pages/SedesPage';
import { PersonalPage } from '../modules/usuarios/pages/PersonalPage';
import { RegistroPage } from '../modules/usuarios/pages/RegistroPage';
import { ClienteLayout } from '../shared/components/ClienteLayout';
import { Dashboard } from '../modules/inicio/pages/Dashboard';
import { MiQr } from '../modules/acceso/pages/MiQr';
import { CompletarMembresia } from '../modules/membresias/pages/CompletarMembresia';
import { ReservarClases } from '../modules/clases/pages/ReservarClases';
import { ReservarCanchas } from '../modules/canchas/pages/ReservarCanchas';
import { MisPagos } from '../modules/pagos/pages/MisPagos';
import { MiMembresia } from '../modules/membresias/pages/MiMembresia';


export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/registro" element={<RegistroPage />} />

      <Route path="/login" element={<Login audience="cliente" redirectTo="/dashboard" />} />
      <Route path="/admin/login" element={<Login audience="staff" redirectTo="/admin" />} />
      <Route
        path="/completar-membresia"
        element={
          <ProtectedRoute loginPath="/login">
            <CompletarMembresia />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute loginPath="/login">
            <ClienteLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mi-qr" element={<MiQr />} />
        <Route path="/qr" element={<MiQr />} />
        <Route path="/clases" element={<ReservarClases />} />
        <Route path="/canchas" element={<ReservarCanchas />} />
        <Route path="/pagos" element={<MisPagos />} />
        <Route path="/membresia" element={<MiMembresia />} />
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
          path="sedes"
          element={
          <ProtectedRoute allowedRoles={[TipoActor.GERENTE]} loginPath="/admin/login">
            <SedesPage />
          </ProtectedRoute>
          }
        />
       <Route
  path="personal"
  element={
    <ProtectedRoute allowedRoles={[TipoActor.GERENTE]} loginPath="/admin/login">
      <PersonalPage />
    </ProtectedRoute>
  }
/>
<Route
  path="personal/nuevo"
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