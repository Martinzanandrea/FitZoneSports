import { IsEnum, IsOptional } from 'class-validator';
import { EstadoMembresia } from '../../entities/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class UpdateMembresiaDto {
  // Solo se puede actualizar el estado manualmente (ej: SUSPENDIDO).
  // Cambiar de plan o de fechas ameritaría crear una membresía nueva,
  // no editar la existente (mejor trazabilidad histórica).
  @ApiPropertyOptional({ enum: EstadoMembresia, example: EstadoMembresia.SUSPENDIDO })
  @IsEnum(EstadoMembresia)
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  estado?: EstadoMembresia;

  @IsOptional()
  renovacionAuto?: boolean;
}
