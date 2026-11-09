import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBloqueoDto {
  @ApiProperty({ example: '2026-09-10T08:00:00.000Z' })
  @IsDateString()
  desde!: string;

  @ApiProperty({ example: '2026-09-10T12:00:00.000Z' })
  @IsDateString()
  hasta!: string;

  @ApiPropertyOptional({ example: 'Mantenimiento' })
  @IsString()
  @IsOptional()
  motivo?: string;
}
