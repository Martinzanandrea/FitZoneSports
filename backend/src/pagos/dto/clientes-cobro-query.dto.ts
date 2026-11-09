import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ClientesCobroQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  // Tope de 20: la pantalla de cobro nunca necesita más por página.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 20;

  /** Filtra por nombre, apellido o DNI. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
