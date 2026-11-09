import { IsString, Matches, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidarCodigoDto {
  @ApiProperty({ example: '482913' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  codigo!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sedeId!: string;
}
