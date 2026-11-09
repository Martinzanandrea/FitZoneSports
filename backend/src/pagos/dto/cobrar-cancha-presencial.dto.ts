import { IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Cobro presencial de una cancha: no lleva monto. El precio, la
// disponibilidad y la sede los resuelve siempre el servidor.
export class CobrarCanchaPresencialDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  usuarioId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  canchaId!: string;

  @ApiProperty({ example: '2026-10-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD',
  })
  fecha!: string;

  @ApiProperty({ example: '18:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaInicio debe tener formato HH:MM',
  })
  horaInicio!: string;

  @ApiProperty({ example: '19:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaFin debe tener formato HH:MM',
  })
  horaFin!: string;
}
