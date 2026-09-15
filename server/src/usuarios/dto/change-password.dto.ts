import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'clave-actual-123' })
  @IsString()
  @MinLength(1)
  passwordActual!: string;

  @ApiProperty({ example: 'nueva-clave-123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
