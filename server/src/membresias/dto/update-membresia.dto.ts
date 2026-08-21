import { IsEnum, IsOptional } from 'class-validator';
import { EstadoMembresia } from '../../entities/enums';
export class UpdateMembresiaDto {
  // Solo se puede actualizar el estado manualmente (ej: SUSPENDIDO).
  // Cambiar de plan o de fechas ameritaría crear una membresía nueva,
  // no editar la existente (mejor trazabilidad histórica).
  @IsEnum(EstadoMembresia)
  @IsOptional()
  estado?: EstadoMembresia;

  @IsOptional()
  renovacionAuto?: boolean;
}
