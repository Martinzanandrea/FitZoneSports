import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { AuditoriaService } from './auditoria.service';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TipoActor.GERENTE)
@ApiTags('Auditoría')
@ApiCookieAuth('token')
@Controller('admin/auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar registros de auditoría' })
  @ApiQuery({ name: 'entidad', required: false })
  @ApiQuery({ name: 'desde', required: false, description: 'Fecha inicial en formato ISO' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Fecha final en formato ISO' })
  findAll(
    @Query('entidad') entidad?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.auditoriaService.findAll({ entidad, desde, hasta });
  }
}
