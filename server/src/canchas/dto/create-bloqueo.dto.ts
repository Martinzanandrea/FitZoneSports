import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateBloqueoDto {
  @IsDateString()
  desde!: string;

  @IsDateString()
  hasta!: string;

  @IsString()
  @IsOptional()
  motivo?: string;
}
