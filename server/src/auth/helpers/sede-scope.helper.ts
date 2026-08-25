import { ForbiddenException } from '@nestjs/common';
import { TipoActor } from '../../entities/enums';
import { UsuarioAutenticado } from '../types/usuario-autenticado.type';

export function assertSedeScope(
  currentUser: UsuarioAutenticado,
  targetSedeId: string,
): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (currentUser.tipoActor === TipoActor.GERENTE) return;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (currentUser.tipoActor === TipoActor.RECEPCIONISTA) {
    if (currentUser.sedeId !== targetSedeId) {
      throw new ForbiddenException('No tenés permisos sobre esta sede');
    }
    return;
  }

  throw new ForbiddenException('No tenés permisos sobre esta sede');
}
