import { TipoActor } from '../../shared/types/enums';

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  apellido: string;
  tipoActor: TipoActor;
}

export interface LoginPayload {
  email: string;
  password: string;
}