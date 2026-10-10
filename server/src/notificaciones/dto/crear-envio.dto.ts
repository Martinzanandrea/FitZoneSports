import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AudienciaEnvio, CanalNotificacion } from '../notificaciones.types';

export const MAX_TITULO = 120;
export const MAX_MENSAJE = 1000;

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CrearEnvioDto {
  @ApiProperty({ maxLength: MAX_TITULO })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITULO)
  titulo!: string;

  @ApiProperty({ maxLength: MAX_MENSAJE })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MENSAJE)
  mensaje!: string;

  @ApiProperty({ enum: AudienciaEnvio })
  @IsEnum(AudienciaEnvio)
  audiencia!: AudienciaEnvio;

  @ApiPropertyOptional({
    description: 'Obligatoria si audiencia = SOCIOS_DE_SEDE',
  })
  @ValidateIf(
    (o: CrearEnvioDto) => o.audiencia === AudienciaEnvio.SOCIOS_DE_SEDE,
  )
  @IsUUID()
  sedeId?: string;

  @ApiPropertyOptional({ description: 'Obligatorio si audiencia = SOCIO' })
  @ValidateIf((o: CrearEnvioDto) => o.audiencia === AudienciaEnvio.SOCIO)
  @IsUUID()
  usuarioId?: string;

  @ApiProperty({ enum: CanalNotificacion, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsEnum(CanalNotificacion, { each: true })
  canales!: CanalNotificacion[];
}
