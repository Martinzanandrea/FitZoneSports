import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class RegistrarPagoEfectivoDto {
  @IsUUID()
  usuarioId: string;

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
  @IsOptional()
  @Min(0.01)
  monto?: number;
}
