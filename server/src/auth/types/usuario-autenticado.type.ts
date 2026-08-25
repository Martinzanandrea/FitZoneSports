export interface UsuarioAutenticado {
  id: string;
  tipoActor: string;
  email: string;
  sedeId: string | null;
}
