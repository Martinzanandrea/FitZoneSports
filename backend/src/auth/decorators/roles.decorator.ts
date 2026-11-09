import { SetMetadata } from '@nestjs/common';
import { TipoActor } from '../../entities/enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TipoActor[]) => SetMetadata(ROLES_KEY, roles);
