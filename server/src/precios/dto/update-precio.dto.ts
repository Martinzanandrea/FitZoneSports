import { IsNumber, Min } from 'class-validator';

export class UpdatePrecioDto {
  @IsNumber()
  @Min(0.01)
  precio!: number;
}
