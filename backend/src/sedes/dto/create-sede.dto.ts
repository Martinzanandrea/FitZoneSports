import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSedeDto {
  @ApiProperty({
    description: 'Nombre de la sede',
    example: 'Sede Central',
  })
  @IsString()
  @IsNotEmpty()
  nombre!: string;


  @ApiProperty({
    description: 'Dirección de la sede',
    example: 'Calle Principal 123',
  })
  @IsString()
  @IsNotEmpty()
  direccion!: string;

  @ApiProperty({
    description: 'Aforo máximo de la sede',
    example: 100,
    
  })
  @IsInt()
  @Min(1)
  aforoMaximo!: number;

  @ApiPropertyOptional({
    description: 'Indica si la sede está activa',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  activa!: boolean;
}
