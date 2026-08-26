import { IsEnum, IsString, MinLength } from 'class-validator';
import { TipoActor } from '../../entities/enums';

export class AssignRoleDto {
  @IsEnum(TipoActor)
  tipoActor!: TipoActor;

  @IsString()
  @MinLength(8)
  password!: string;
}
