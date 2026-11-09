import { SetMetadata } from '@nestjs/common';
export const AUDITABLE_KEY = 'auditable';
export interface AuditableMeta { accion: string; entidad: string; }
export const Auditable = (accion: string, entidad: string) =>
  SetMetadata(AUDITABLE_KEY, { accion, entidad });
