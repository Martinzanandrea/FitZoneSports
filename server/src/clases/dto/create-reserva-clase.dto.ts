import { IsUUID } from 'class-validator';

export class CreateReservaClaseDto {
  @IsUUID()
  usuarioId!: string;
}
