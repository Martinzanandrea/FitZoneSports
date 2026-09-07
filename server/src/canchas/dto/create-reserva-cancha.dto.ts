import { IsDateString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReservaCanchaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  canchaId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  usuarioId!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  fecha!: string; // "2026-08-25"

  // formato HH:MM, 24hs
  @ApiProperty({ example: '18:00', description: 'Hora de inicio en formato HH:MM' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaInicio debe tener formato HH:MM',
  })
  horaInicio!: string;

  @ApiProperty({ example: '19:00', description: 'Hora de fin en formato HH:MM' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaFin debe tener formato HH:MM',
  })
  horaFin!: string;
}
