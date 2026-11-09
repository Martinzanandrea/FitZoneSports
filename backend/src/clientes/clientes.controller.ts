import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { ClientesService } from './clientes.service';
import { ClientesQueryDto } from './dto/clientes-query.dto';

@ApiTags('Clientes')
@ApiCookieAuth('token')
@Controller('personal/clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL)
  @Get()
  @ApiOperation({
    summary:
      'Listar socios, externos e instructores de la cadena (solo Gerente General)',
  })
  listar(@Query() query: ClientesQueryDto) {
    return this.clientesService.listar(query);
  }
}
