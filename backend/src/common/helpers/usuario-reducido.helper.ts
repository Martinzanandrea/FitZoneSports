import type { Usuario } from '../../entities';

// Única forma en que un listado de reservas puede mostrar a un usuario:
// sin dni, email, teléfono, fotoUrl ni otros campos de cuenta.
export interface UsuarioReducido {
  id: string;
  nombre: string;
  apellido: string;
}

export function usuarioReducido(
  u: Pick<Usuario, 'id' | 'nombre' | 'apellido'>,
): UsuarioReducido {
  return { id: u.id, nombre: u.nombre, apellido: u.apellido };
}
