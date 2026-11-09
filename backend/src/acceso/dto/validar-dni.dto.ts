import { Transform } from 'class-transformer';
import { IsString, Matches, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Acepta el DNI con puntos o espacios ("30.123.456") y lo normaliza a dígitos.
const soloDigitos = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/[.\s]/g, '') : value;

export class ValidarDniDto {
  @ApiProperty({ example: '30123456' })
  @Transform(soloDigitos)
  @IsString()
  @Matches(/^\d{6,9}$/, { message: 'El DNI debe tener entre 6 y 9 dígitos' })
  dni!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sedeId!: string;
}
