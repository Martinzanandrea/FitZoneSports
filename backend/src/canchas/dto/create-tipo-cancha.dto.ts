import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTipoCanchaDto {
  @ApiProperty({ example: 'Tenis', description: 'Nombre del tipo de cancha' })
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
  nombre!: string;
}
