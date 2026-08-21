// Lo que realmente viaja en el JWT y devuelve JwtStrategy.validate().
// NO es la entidad Usuario completa — es un subconjunto liviano.
export interface UsuarioAutenticado {
  id: string;
  tipoActor: string;
  email: string;
}
