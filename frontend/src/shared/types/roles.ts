import { TipoActor } from './enums';

// Listas de roles compartidas por el login, los guards de ruta y los menús.
// GERENTE_SEDE es personal (staff) y administra su propia sede.
export const ROLES_CLIENTE: TipoActor[] = [TipoActor.SOCIO, TipoActor.EXTERNO];
export const ROLES_GERENTES: TipoActor[] = [TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE];
export const ROLES_STAFF: TipoActor[] = [TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE, TipoActor.GERENTE_GENERAL];
