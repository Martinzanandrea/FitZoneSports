import { TipoActor } from '../types/enums';

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
