import { TipoActor } from '../entities/enums';

// Para endpoints que cualquier usuario autenticado puede llamar PERO donde el
// alcance real (dueño del recurso, sede) se valida en el servicio. Se lista
// explícito en vez de dejar el endpoint sin @Roles: así una auditoría ve que la
// decisión fue deliberada, y un test impide que aparezcan endpoints sin rol.
export const TODOS_LOS_ROLES: TipoActor[] = [
  TipoActor.SOCIO,
  TipoActor.EXTERNO,
  TipoActor.RECEPCIONISTA,
  TipoActor.GERENTE_SEDE,
  TipoActor.GERENTE_GENERAL,
];

export const ROLES_CLIENTES: TipoActor[] = [TipoActor.SOCIO, TipoActor.EXTERNO];
