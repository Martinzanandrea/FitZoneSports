import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class HorarioClaseDto {
  @ApiProperty({ example: 1, description: 'Día de semana: 0 (domingo) a 6 (sábado)' })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;

  @ApiProperty({ example: '19:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaInicio debe tener formato HH:MM',
  })
  horaInicio!: string;

  @ApiProperty({ example: '20:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaFin debe tener formato HH:MM',
  })
  horaFin!: string;
}

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

  @ApiProperty({ example: 30, minimum: 1 })
  @IsInt()
  @Min(1)
  capacidad!: number;

  @ApiProperty({ example: 6, description: 'Carga horaria semanal total' })
  @IsNumber()
  @Min(0.5)
  horasSemanalesTotales!: number;

  @ApiProperty({
    type: [HorarioClaseDto],
    description:
      'Grilla semanal ya confirmada por el Gerente (pasó por la sugerencia + edición antes de llegar acá)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HorarioClaseDto)
  horarios!: HorarioClaseDto[];
}
