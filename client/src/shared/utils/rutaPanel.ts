import { TipoActor } from '../types/enums';
import { leerUltimoAcceso } from './ultimoAcceso';

// Panel de inicio de cada rol de staff. Lo comparten AdminIndex y los botones
// públicos (landing). Devuelve null si el rol no es de staff.
export function rutaPanelStaff(tipo: TipoActor): string | null {
  if (tipo === TipoActor.GERENTE_GENERAL) return '/admin/gerente';
  if (tipo === TipoActor.GERENTE_SEDE) return '/admin/sede';
  if (tipo === TipoActor.RECEPCIONISTA) return '/admin/recepcion';
  return null;
}

// Panel de inicio de cualquier rol autenticado: los clientes van a /dashboard
// y el staff a su propio panel. Sirve para los guards de ruta, así un usuario
// con sesión activa nunca termina en /login.
export function rutaPanelPorRol(tipo: TipoActor): string {
  return rutaPanelStaff(tipo) ?? '/dashboard';
}

// Inicio de la app instalada: panel del rol con sesión; sin sesión, el login del último
// tipo de acceso usado (personal o clientes; clientes si no hay dato).
export function destinoInicioApp(tipo?: TipoActor): string {
  if (tipo) return rutaPanelPorRol(tipo);
  return leerUltimoAcceso() === 'staff' ? '/admin/login' : '/login';
}
