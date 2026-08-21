import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TipoCancha } from '../../entities/enums';

export class CreateCanchaDto {
  @IsUUID()
  sedeId!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsEnum(TipoCancha)
  tipo!: TipoCancha;

  @IsNumber()
  @Min(0.01)
  costoHoraBase!: number;
}
