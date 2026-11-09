import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// A propósito NO incluye el horario semanal: si hay que cambiar el
// horario, se desactiva la clase y se crea una nueva.
export class UpdateClaseDto {
  @ApiPropertyOptional({ example: 'Funcional' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @IsOptional()
  tipoClase?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsOptional()
  instructorId?: string;

  @ApiPropertyOptional({ example: 30, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacidad?: number;
}
