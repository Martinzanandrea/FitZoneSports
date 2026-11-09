import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { TipoActor } from '../entities/enums';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuditoriaService } from './auditoria.service';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
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
    @CurrentUser() user: UsuarioAutenticado,
    @Query('entidad') entidad?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.auditoriaService.findAll({ entidad, desde, hasta }, query ?? {}, user);
  }
}
