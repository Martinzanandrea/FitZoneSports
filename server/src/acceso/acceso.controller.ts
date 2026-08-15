import { Controller } from '@nestjs/common';
import { AccesoService } from './acceso.service';

@Controller('acceso')
export class AccesoController {
  constructor(private readonly accesoService: AccesoService) {}
}
