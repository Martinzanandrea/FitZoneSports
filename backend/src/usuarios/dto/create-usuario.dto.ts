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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUsuarioDto {
  @ApiProperty({ enum: TipoActor, example: TipoActor.SOCIO })
  @IsEnum(TipoActor)
  tipoActor!: TipoActor;

  // DNI sigue condicional: obligatorio solo para SOCIO/EXTERNO
  @ApiPropertyOptional({ example: '30123456', description: 'Obligatorio para SOCIO y EXTERNO' })
  @ValidateIf(
    (dto) =>
      dto.tipoActor === TipoActor.SOCIO || dto.tipoActor === TipoActor.EXTERNO,
  )
  @ApiProperty({ example: 'Andrea' })
  @IsString()
  @IsNotEmpty()
  dni?: string;

  @ApiProperty({ example: 'Martínez' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  apellido!: string;

  // Obligatorio para TODOS: es el usuario de login.
  @ApiProperty({ example: 'andrea@fitzone.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+54 11 5555-5555' })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional({ example: 'https://example.com/foto.jpg' })
  @IsString()
  @IsOptional()
  fotoUrl?: string;

  // Obligatorio para TODOS: es la contraseña de login.
  @ApiProperty({ example: '12345678', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  sedeId?: string;
}
