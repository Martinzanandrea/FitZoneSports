import { Controller } from '@nestjs/common';
import { InstructoresService } from './instructores.service';

@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructoresService: InstructoresService) {}
}
