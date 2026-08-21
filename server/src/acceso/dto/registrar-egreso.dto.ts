import { IsUUID } from 'class-validator';

export class RegistrarEgresoDto {
  @IsUUID()
  usuarioId!: string;
}
