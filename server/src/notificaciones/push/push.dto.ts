import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const MAX_ENDPOINT = 2048;
// Claves de PushSubscription.toJSON(): base64url (se tolera relleno "=").
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

const ENDPOINT_HTTPS = { protocols: ['https'], require_protocol: true };

export class PushKeysDto {
  @ApiProperty({ maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @Matches(BASE64URL)
  p256dh!: string;

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(BASE64URL)
  auth!: string;
}

export class SuscribirPushDto {
  @ApiProperty({
    maxLength: MAX_ENDPOINT,
    description: 'URL https del servicio push',
  })
  @IsString()
  @MaxLength(MAX_ENDPOINT)
  @IsUrl(ENDPOINT_HTTPS)
  endpoint!: string;

  @ApiProperty({ type: PushKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class DesuscribirPushDto {
  @ApiProperty({ maxLength: MAX_ENDPOINT })
  @IsString()
  @MaxLength(MAX_ENDPOINT)
  @IsUrl(ENDPOINT_HTTPS)
  endpoint!: string;
}
