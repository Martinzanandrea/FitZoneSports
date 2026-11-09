import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Un ES256 con el payload del QR ronda los 300 caracteres: 2048 deja margen.
export const LARGO_MAXIMO_QR_TOKEN = 2048;
export const MAXIMO_EVENTOS_POR_LOTE = 100;

export class EventoOfflineDto {
  @ApiProperty({
    description: 'Lo genera el terminal: hace idempotente el reenvío',
    example: '3f2b8c1e-5d4a-4e7b-9c1a-2b6d8e0f1a34',
  })
  @IsUUID()
  clientEventId!: string;

  @ApiProperty({ example: 'qr-token-es256' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LARGO_MAXIMO_QR_TOKEN)
  qrToken!: string;

  @ApiProperty({
    description: 'Momento en que el terminal leyó el QR',
    example: '2026-10-09T18:00:00.000Z',
  })
  @IsISO8601({ strict: true })
  ocurridoEn!: string;
}

export class SincronizarAccesoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sedeId!: string;

  @ApiProperty({ type: [EventoOfflineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_EVENTOS_POR_LOTE)
  @ValidateNested({ each: true })
  @Type(() => EventoOfflineDto)
  eventos!: EventoOfflineDto[];
}
