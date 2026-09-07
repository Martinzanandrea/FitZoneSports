import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { MetodoPago } from '../../entities/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePagoDto {
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

  @ApiProperty({ enum: MetodoPago, example: MetodoPago.MERCADOPAGO })
  @IsEnum(MetodoPago)
  metodo!: MetodoPago;

  @ApiPropertyOptional({ example: 15000, minimum: 0.01 })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  monto?: number;

  // Solo para testing: fuerza que el mock rechace el pago.
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  simularRechazo?: boolean;
}
