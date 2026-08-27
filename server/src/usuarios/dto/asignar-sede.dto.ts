import { IsUUID } from 'class-validator';

export class AsignarSedeDto {
  @IsUUID()
  sedeId!: string;
}
