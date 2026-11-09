// Copia local del usuario autenticado, solo para poder abrir la app sin
// conexión (modo offline del terminal de recepción). NO contiene tokens ni
// credenciales: la sesión real sigue en la cookie httpOnly del backend, que
// valida todo al volver la conexión. Solo guarda los campos de UsuarioAutenticado
// (sin email, sin DNI ni teléfono).
import { TipoActor } from '../../shared/types/enums';
import type { UsuarioAutenticado } from './auth.types';

const CLAVE = 'fitzone-usuario-local';
// Pasado este tiempo la copia se descarta: no debe abrir la app indefinidamente.
export const VIGENCIA_COPIA_MS = 24 * 60 * 60 * 1000;

interface CopiaLocal {
  usuario: UsuarioAutenticado;
  guardadoEn: number;
}

// Valida la forma y la antigüedad; null si no sirve. Pura, para poder probarla.
export function interpretarCopiaLocal(texto: string | null, ahora: number = Date.now()): UsuarioAutenticado | null {
  if (!texto) return null;
  try {
    const copia = JSON.parse(texto) as Partial<CopiaLocal> | null;
    const u = copia?.usuario;
    if (
      !u ||
      typeof copia?.guardadoEn !== 'number' ||
      typeof u.id !== 'string' ||
      typeof u.nombre !== 'string' ||
      typeof u.apellido !== 'string' ||
      !Object.values(TipoActor).includes(u.tipoActor) ||
      (u.sedeId !== null && typeof u.sedeId !== 'string')
    ) {
      return null;
    }
    const edad = ahora - copia.guardadoEn;
    if (edad < 0 || edad >= VIGENCIA_COPIA_MS) return null;
    return { id: u.id, nombre: u.nombre, apellido: u.apellido, tipoActor: u.tipoActor, sedeId: u.sedeId };
  } catch {
    return null;
  }
}

export function guardarUsuarioLocal(usuario: UsuarioAutenticado, ahora: number = Date.now()): void {
  const { id, nombre, apellido, tipoActor, sedeId } = usuario;
  const copia: CopiaLocal = { usuario: { id, nombre, apellido, tipoActor, sedeId }, guardadoEn: ahora };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(copia));
  } catch {
    /* sin localStorage: simplemente no habrá arranque offline */
  }
}

export function leerUsuarioLocal(ahora: number = Date.now()): UsuarioAutenticado | null {
  try {
    return interpretarCopiaLocal(localStorage.getItem(CLAVE), ahora);
  } catch {
    return null;
  }
}

export function borrarUsuarioLocal(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
