import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EstadoPago } from '../../entities/enums';

export const METODOS_HISTORIAL = ['EFECTIVO', 'ONLINE'] as const;
export const TIPOS_HISTORIAL = ['MEMBRESIA', 'CANCHA'] as const;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// "Mis pagos": solo paginación; el usuario sale siempre del JWT.
export class MisPagosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class HistorialPagosQueryDto extends MisPagosQueryDto {
  /** Fecha (hora Argentina) desde, inclusive: YYYY-MM-DD. */
  @IsOptional()
  @Matches(FECHA, { message: 'desde debe tener formato YYYY-MM-DD' })
  desde?: string;

  /** Fecha (hora Argentina) hasta, inclusive: YYYY-MM-DD. */
  @IsOptional()
  @Matches(FECHA, { message: 'hasta debe tener formato YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @IsIn(METODOS_HISTORIAL)
  metodo?: (typeof METODOS_HISTORIAL)[number];

  @IsOptional()
  @IsIn(TIPOS_HISTORIAL)
  tipo?: (typeof TIPOS_HISTORIAL)[number];

  @IsOptional()
  @IsEnum(EstadoPago)
  estado?: EstadoPago;

  /** Nombre, apellido o DNI (mínimo 3 caracteres). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  q?: string;

  /** Solo lo respeta el Gerente General; el resto queda en su sede. */
  @IsOptional()
  @IsUUID()
  sedeId?: string;
}
