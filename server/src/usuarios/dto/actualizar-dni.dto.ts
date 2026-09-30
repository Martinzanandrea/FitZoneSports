import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActualizarDniDto {
  @ApiProperty({ example: '30123456' })
  @IsString()
  @IsNotEmpty()
  dni!: string;
}
