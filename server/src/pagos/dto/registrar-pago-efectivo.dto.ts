import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegistrarPagoEfectivoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  usuarioId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsOptional()
  membresiaId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  @IsOptional()
  reservaClaseId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440003' })
  @IsUUID()
  @IsOptional()
  reservaCanchaId?: string;

  @ApiPropertyOptional({ example: 15000, minimum: 0.01 })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  monto?: number;
}
