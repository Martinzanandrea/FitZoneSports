import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum TipoCliente {
  SOCIO = 'SOCIO',
  EXTERNO = 'EXTERNO',
  INSTRUCTOR = 'INSTRUCTOR',
}

export class ClientesQueryDto extends PaginationQueryDto {
  /** Busca por nombre, apellido, DNI o email. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(TipoCliente)
  tipo?: TipoCliente;

  @IsOptional()
  @IsIn(['ACTIVO', 'BAJA'])
  estado?: 'ACTIVO' | 'BAJA';
}
