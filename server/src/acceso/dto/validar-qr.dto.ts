import { IsString, IsUUID } from 'class-validator';

export class ValidarQrDto {
  @IsString()
  qrToken!: string;

  @IsUUID()
  sedeId!: string;
}
