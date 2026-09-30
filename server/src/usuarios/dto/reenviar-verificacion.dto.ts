import { IsEmail } from 'class-validator';

export class ReenviarVerificacionDto {
  @IsEmail()
  email!: string;
}
