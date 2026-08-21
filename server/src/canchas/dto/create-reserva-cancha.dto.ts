import { IsDateString, IsUUID, Matches } from 'class-validator';

export class CreateReservaCanchaDto {
  @IsUUID()
  canchaId!: string;

  @IsUUID()
  usuarioId!: string;

  @IsDateString()
  fecha!: string; // "2026-08-25"

  // formato HH:MM, 24hs
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaInicio debe tener formato HH:MM',
  })
  horaInicio!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaFin debe tener formato HH:MM',
  })
  horaFin!: string;
}
