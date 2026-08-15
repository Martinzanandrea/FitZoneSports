import { Controller } from '@nestjs/common';
import { CanchasService } from './canchas.service';

@Controller('canchas')
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}
}
