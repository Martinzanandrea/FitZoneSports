import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFranjaDto {
  @ApiProperty({
    description: 'Hora de apertura en formato HH:MM',
    example: '08:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'apertura debe tener formato HH:MM',
  })
  apertura!: string;

  @ApiProperty({
    description: 'Hora de cierre en formato HH:MM',
    example: '22:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'cierre debe tener formato HH:MM',
  })
  cierre!: string;
}
