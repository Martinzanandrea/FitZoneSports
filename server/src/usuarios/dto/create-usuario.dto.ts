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
  tipoActor: TipoActor;

  //Si es socio o externo, el dni es obligatorio
  @ValidateIf(
    (dto) =>
      dto.tipoActor === TipoActor.SOCIO || dto.tipoActor === TipoActor.EXTERNO,
  )
  @IsNotEmpty()
  @IsString()
  dni?: string;

  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsString()
  @IsNotEmpty()
  apellido?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  fotoUrl?: string;

  // Obligatorio solo si es RECEPCIONISTA o GERENTE .
  // el hasheo lo hace el service ANTES de guardar. Nunca llega hasheada desde acá.
  @ValidateIf(
    (dto) =>
      dto.tipoActor === TipoActor.RECEPCIONISTA ||
      dto.tipoActor === TipoActor.GERENTE,
  )
  @IsString()
  @MinLength(8)
  password?: string;

  // Sede de trabajo (recepcionista) o de alta (externo). No aplica a socio/gerente.
  @IsUUID()
  @IsOptional()
  sedeId?: string;
}
