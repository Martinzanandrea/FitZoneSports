import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUsuarioDto } from './create-usuario.dto';

// Se excluye "password" del update
// no mezclado con la edición de datos generales.
export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['password'] as const),
) {}
