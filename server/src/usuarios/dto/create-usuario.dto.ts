import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TipoActor } from '../../entities/enums';

export class CreateUsuarioDto {
  @IsEnum(TipoActor)
  tipoActor!: TipoActor;

  // DNI sigue condicional: obligatorio solo para SOCIO/EXTERNO
  @ValidateIf(
    (dto) =>
      dto.tipoActor === TipoActor.SOCIO || dto.tipoActor === TipoActor.EXTERNO,
  )
  @IsString()
  @IsNotEmpty()
  dni?: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  apellido!: string;

  // Obligatorio para TODOS: es el usuario de login.
  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  fotoUrl?: string;

  // Obligatorio para TODOS: es la contraseña de login.
  @IsString()
  @MinLength(8)
  password!: string;

  @IsUUID()
  @IsOptional()
  sedeId?: string;
}
