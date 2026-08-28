import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor, TipoPlan } from '../entities/enums';
import { PreciosService } from './precios.service';
import { UpdatePrecioDto } from './dto/update-precio.dto';

@Controller('precios/membresias')
export class PreciosController {
  constructor(private readonly preciosService: PreciosService) {}

  // Público: el frontend necesita mostrar precios antes de que el
  // usuario se registre/pague.
  @Get('publico')
  findAllPublico() {
    return this.preciosService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':plan')
  actualizar(@Param('plan') plan: TipoPlan, @Body() dto: UpdatePrecioDto) {
    return this.preciosService.actualizarPrecio(plan, dto.precio);
  }
}
