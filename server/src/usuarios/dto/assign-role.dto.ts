import { IsEnum, IsString, MinLength } from 'class-validator';
import { TipoActor } from '../../entities/enums';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ enum: TipoActor, example: TipoActor.RECEPCIONISTA })
  @IsEnum(TipoActor)
  tipoActor!: TipoActor;

  @ApiProperty({ example: '12345678', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
