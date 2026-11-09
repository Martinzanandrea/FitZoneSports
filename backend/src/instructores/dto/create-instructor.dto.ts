import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInstructorDto {
  @ApiProperty({ example: 'Andrea Martínez' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiPropertyOptional({ example: 'Yoga' })
  @IsString()
  @IsOptional()
  especialidad?: string;

  @ApiPropertyOptional({ example: '+54 11 5555-5555' })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
