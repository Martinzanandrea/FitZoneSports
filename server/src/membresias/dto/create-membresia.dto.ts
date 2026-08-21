import { TipoPlan } from '../../entities/enums';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateMembresiaDto {
  @IsUUID()
  usuarioId!: string;

  @IsUUID()
  sedeAltaId!: string;

  @IsEnum(TipoPlan)
  plan!: TipoPlan;

  @IsOptional()
  renovacionAuto?: boolean;
}
