import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClaseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sedeId!: string;

  @ApiProperty({ example: 'Funcional' })
  @IsString()
  @IsNotEmpty()
  tipoClase!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  instructorId!: string;

  @ApiProperty({ example: '2026-09-10T18:00:00.000Z' })
  @IsDateString()
  horarioInicio!: string;

  @ApiProperty({ example: '2026-09-10T19:00:00.000Z' })
  @IsDateString()
  horarioFin!: string;

  @ApiProperty({ example: 30, minimum: 1 })
  @IsInt()
  @Min(1)
  capacidad!: number;
}
