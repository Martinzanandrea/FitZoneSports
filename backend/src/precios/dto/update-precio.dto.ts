import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePrecioDto {
  @ApiProperty({ example: 15000, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  precio!: number;
}
