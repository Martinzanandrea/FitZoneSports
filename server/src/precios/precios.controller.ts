import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor, TipoPlan } from '../entities/enums';
import { PreciosService } from './precios.service';
import { UpdatePrecioDto } from './dto/update-precio.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Precios')
@Controller('precios/membresias')
export class PreciosController {
  constructor(private readonly preciosService: PreciosService) {}

  // Público: el frontend necesita mostrar precios antes de que el
  // usuario se registre/pague.
  @Get('publico')
  @ApiOperation({ summary: 'Obtener precios públicos de membresías' })
  findAllPublico() {
    return this.preciosService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':plan')
  @ApiCookieAuth('token')
  @ApiOperation({ summary: 'Actualizar precio de un plan' })
  @ApiParam({ name: 'plan', description: 'Tipo de plan de membresía' })
  @Auditable('ACTUALIZAR_PRECIO', 'PrecioPlan')
  actualizar(@Param('plan') plan: TipoPlan, @Body() dto: UpdatePrecioDto) {
    return this.preciosService.actualizarPrecio(plan, dto.precio);
  }
}
