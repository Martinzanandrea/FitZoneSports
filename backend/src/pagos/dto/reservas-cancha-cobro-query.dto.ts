import { IsUUID } from 'class-validator';

export class ReservasCanchaCobroQueryDto {
  @IsUUID()
  usuarioId!: string;
}
