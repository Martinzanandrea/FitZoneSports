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
    if (!rolesRequeridos) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!rolesRequeridos.includes(user.tipoActor)) {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }
    return true;
  }
}
