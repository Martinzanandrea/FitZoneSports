import { IsUUID } from 'class-validator';

export class AsignarInstructorDto {
  @IsUUID()
  instructorId!: string;
}
