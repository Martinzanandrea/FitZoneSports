import { TipoPlan } from '../../entities/enums';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMembresiaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  usuarioId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  sedeAltaId!: string;

  @ApiProperty({ enum: TipoPlan, example: TipoPlan.MENSUAL })
  @IsEnum(TipoPlan)
  plan!: TipoPlan;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  renovacionAuto?: boolean;
}
