import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
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
  @Min(0.01)
  monto!: number;
}
