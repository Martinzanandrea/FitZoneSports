import { ForbiddenException } from '@nestjs/common';
import { TipoActor } from '../../entities/enums';

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
    currentUser.tipoActor === TipoActor.GERENTE;

  if (!esStaff && currentUser.id !== targetUserId) {
    throw new ForbiddenException(
      'No tenés permisos para acceder a este recurso',
    );
  }
}
