import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCanchaDto } from './create-cancha.dto';
import { EstadoCancha } from '../../entities/enums';

export class UpdateCanchaDto extends PartialType(CreateCanchaDto) {
  @IsEnum(EstadoCancha)
  @IsOptional()
  estado?: EstadoCancha;
}
