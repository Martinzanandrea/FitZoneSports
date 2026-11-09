import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTipoCanchaDto {
  @ApiPropertyOptional({ example: 'Pádel', description: 'Nuevo nombre del tipo' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[\p{L}\s\d]+$/u, {
    message: 'El nombre solo puede contener letras, números y espacios',
  })
  @Matches(/(?=.*\p{L})/u, {
    message: 'El nombre debe incluir al menos una letra',
  })
  @IsOptional()
  nombre?: string;
}
