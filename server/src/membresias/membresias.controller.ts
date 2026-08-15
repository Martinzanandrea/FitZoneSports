import { Controller } from '@nestjs/common';
import { MembresiasService } from './membresias.service';

@Controller('membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}
}
