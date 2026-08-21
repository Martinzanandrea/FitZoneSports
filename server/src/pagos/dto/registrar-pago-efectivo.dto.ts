import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class RegistrarPagoEfectivoDto {
  @IsUUID()
  usuarioId!: string;

  // TEMPORAL: cuando integremos el guard, esto sale de @CurrentUser(),
  // no del body. Ver el ajuste que hacemos en el paso 5 de este mensaje.
  @IsUUID()
  registradoPorId!: string;

  @IsUUID()
  @IsOptional()
  membresiaId?: string;

  @IsUUID()
  @IsOptional()
  reservaClaseId?: string;

  @IsUUID()
  @IsOptional()
  reservaCanchaId?: string;

  @IsNumber()
  @Min(0.01)
  monto!: number;
}
