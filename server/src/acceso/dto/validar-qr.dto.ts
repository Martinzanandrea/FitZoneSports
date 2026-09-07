import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidarQrDto {
  @ApiProperty({ example: 'qr-token-generado' })
  @IsString()
  qrToken!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sedeId!: string;
}
