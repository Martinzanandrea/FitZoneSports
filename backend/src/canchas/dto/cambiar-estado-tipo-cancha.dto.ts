import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambiarEstadoTipoCanchaDto {
  @ApiProperty({ example: false, description: 'Activar o desactivar el tipo' })
  @IsBoolean()
  activo!: boolean;
}
