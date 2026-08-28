import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { MetodoPago } from '../../entities/enums';

export class CreatePagoDto {
  @IsUUID()
  usuarioId!: string;

  @IsUUID()
  @IsOptional()
  membresiaId?: string;

  @IsUUID()
  @IsOptional()
  reservaClaseId?: string;

  @IsUUID()
  @IsOptional()
  reservaCanchaId?: string;

  @IsEnum(MetodoPago)
  metodo!: MetodoPago;

  @IsNumber()
  @IsOptional()
  @Min(0.01)
  monto?: number;

  // Solo para testing: fuerza que el mock rechace el pago.
  @IsBoolean()
  @IsOptional()
  simularRechazo?: boolean;
}
