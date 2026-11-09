import { ForbiddenException } from '@nestjs/common';
import { TipoActor } from '../../entities/enums';
import type { UsuarioAutenticado } from '../types/usuario-autenticado.type';

interface UsuarioActual {
  id: string;
  tipoActor: string;
}

// El staff (recepción/gerencia) puede operar sobre cualquier usuario
// (atienden en el mostrador). Cualquier otro actor solo puede operar
// sobre SUS PROPIOS datos.
export function assertOwnerOrStaff(
  currentUser: UsuarioActual,
  targetUserId: string,
): void {
  const esStaff =
    currentUser.tipoActor === TipoActor.RECEPCIONISTA ||
    currentUser.tipoActor === TipoActor.GERENTE_GENERAL ||
    currentUser.tipoActor === TipoActor.GERENTE_SEDE;

  if (!esStaff && currentUser.id !== targetUserId) {
    throw new ForbiddenException(
      'No tenés permisos para acceder a este recurso',
    );
  }
}

interface PerfilObjetivo {
  id: string;
  tipoActor: string;
  sede?: { id: string } | null;
}

// Matriz de lectura/edición de perfiles (ver REGLAS del rol
// GERENTE_SEDE): el propio usuario siempre; GG sobre cualquiera;
// GS solo sobre recepcionistas de su sede y sobre SOCIO/EXTERNO
// (que no tienen sede propia); RECEPCIONISTA solo sobre sí mismo.
export function assertAccesoPerfil(
  actor: UsuarioAutenticado,
  objetivo: PerfilObjetivo,
): void {
  if (actor.id === objetivo.id) return;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (actor.tipoActor === TipoActor.GERENTE_GENERAL) return;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (actor.tipoActor === TipoActor.GERENTE_SEDE) {
    if (!actor.sedeId) {
      throw new ForbiddenException('No tenés sede asignada');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esRecepcionistaPropio =
      objetivo.tipoActor === TipoActor.RECEPCIONISTA &&
      objetivo.sede?.id === actor.sedeId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esCliente =
      objetivo.tipoActor === TipoActor.SOCIO ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      objetivo.tipoActor === TipoActor.EXTERNO;
    if (esRecepcionistaPropio || esCliente) return;
    throw new ForbiddenException(
      'No tenés permisos sobre este perfil',
    );
  }

  throw new ForbiddenException(
    'No tenés permisos para acceder a este recurso',
  );
}
