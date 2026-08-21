import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInstructorDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsOptional()
  especialidad?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
