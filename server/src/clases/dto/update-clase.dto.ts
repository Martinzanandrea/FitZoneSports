import { PartialType } from '@nestjs/swagger';
import { CreateClaseDto } from './create-clase.dto';

export class UpdateClaseDto extends PartialType(CreateClaseDto) {}
