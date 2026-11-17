import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TipoActor } from '../../entities/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<TipoActor[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Sin @Roles el guard deja pasar a cualquier usuario autenticado; el spec
    // auditoria-endpoints exige @Roles en todo endpoint no público.
    if (!rolesRequeridos) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!rolesRequeridos.includes(user.tipoActor)) {
      throw new ForbiddenException(
        'No tenés permisos para realizar esta acción',
      );
    }
    return true;
  }
}
