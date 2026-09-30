import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// DTO cerrado a propósito: SOLO estos 5 campos pueden editarse por el
// endpoint general PATCH /usuarios/:id. tipoActor, sedeId y dni NO
// existen acá: tienen sus endpoints dedicados (solo GERENTE) o no se
// editan por API. Con el whitelist global, lo no declarado se ignora;
// con forbidNonWhitelisted en el controller, además se rechaza con 400.
export class UpdateUsuarioDto {
  @ApiPropertyOptional({ example: 'Andrea' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ example: 'Martínez' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  apellido?: string;

  @ApiPropertyOptional({ example: 'andrea@fitzone.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+54 11 5555-5555' })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional({ example: 'https://example.com/foto.jpg' })
  @IsString()
  @IsOptional()
  fotoUrl?: string;
}
