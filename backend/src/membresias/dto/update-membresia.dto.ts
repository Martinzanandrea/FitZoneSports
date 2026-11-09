import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoMembresia } from '../../entities/enums';

// Solo se puede suspender (ACTIVO -> SUSPENDIDO) o reactivar una suspendida
// (SUSPENDIDO -> ACTIVO, si no genera superposición). VENCIDO lo marca el
// sistema y las fechas o el plan no se editan: ameritan una membresía nueva
// (mejor trazabilidad histórica).
export const ESTADOS_EDITABLES = [
  EstadoMembresia.ACTIVO,
  EstadoMembresia.SUSPENDIDO,
] as const;

export class UpdateMembresiaDto {
  @ApiPropertyOptional({
    enum: ESTADOS_EDITABLES,
    example: EstadoMembresia.SUSPENDIDO,
  })
  @IsOptional()
  @IsIn(ESTADOS_EDITABLES)
  estado?: EstadoMembresia;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  renovacionAuto?: boolean;
}
