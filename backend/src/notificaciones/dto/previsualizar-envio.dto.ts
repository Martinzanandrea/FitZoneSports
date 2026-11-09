import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { AudienciaEnvio } from '../notificaciones.types';

export class PrevisualizarEnvioDto {
  @ApiProperty({ enum: AudienciaEnvio })
  @IsEnum(AudienciaEnvio)
  audiencia!: AudienciaEnvio;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: PrevisualizarEnvioDto) => o.audiencia === AudienciaEnvio.SOCIOS_DE_SEDE,
  )
  @IsUUID()
  sedeId?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: PrevisualizarEnvioDto) => o.audiencia === AudienciaEnvio.SOCIO,
  )
  @IsUUID()
  usuarioId?: string;
}
