import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSedeDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  direccion: string;

  @IsInt()
  @Min(1)
  aforoMaximo: number;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}
