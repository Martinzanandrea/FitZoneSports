import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateClaseDto {
  @IsUUID()
  sedeId!: string;

  @IsString()
  @IsNotEmpty()
  tipoClase!: string;

  @IsUUID()
  instructorId!: string;

  @IsDateString()
  horarioInicio!: string;

  @IsDateString()
  horarioFin!: string;

  @IsInt()
  @Min(1)
  capacidad!: number;
}
