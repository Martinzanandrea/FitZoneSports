import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCanchaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'UUID de la sede' })
  @IsUUID()
  sedeId!: string;

  @ApiProperty({ example: 'Cancha 1', description: 'Nombre de la cancha' })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'UUID del tipo de cancha' })
  @IsUUID()
  tipoId!: string;

  @ApiProperty({ example: 2500, minimum: 0.01, description: 'Costo base por hora' })
  @IsNumber()
  @Min(0.01)
  costoHoraBase!: number;
}
