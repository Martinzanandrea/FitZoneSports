import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { TipoActor } from '../entities/enums';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { NotificacionesService } from './notificaciones.service';
import { CrearEnvioDto } from './dto/crear-envio.dto';
import { PrevisualizarEnvioDto } from './dto/previsualizar-envio.dto';
import { NotificacionesQueryDto } from './dto/notificaciones-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Notificaciones')
@ApiCookieAuth('token')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  // ───────── Solo SOCIO, sobre sus propias notificaciones ─────────

  @Roles(TipoActor.SOCIO)
  @Get()
  @ApiOperation({ summary: 'Mis notificaciones (paginado, máx. 20)' })
  listar(
    @Query() query: NotificacionesQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.listar(user.id, query);
  }

  @Roles(TipoActor.SOCIO)
  @Get('no-leidas/conteo')
  @ApiOperation({ summary: 'Cantidad de notificaciones sin leer' })
  contarNoLeidas(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.contarNoLeidas(user.id);
  }

  @Roles(TipoActor.SOCIO)
  @Patch('leer-todas')
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  leerTodas(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.marcarTodasLeidas(user.id);
  }

  @Roles(TipoActor.SOCIO)
  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marcar una notificación propia como leída' })
  marcarLeida(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.marcarLeida(id, user.id);
  }

  // ───────── Solo GERENTE_GENERAL: avisos a Socios ─────────

  @Roles(TipoActor.GERENTE_GENERAL)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('envios')
  @ApiOperation({ summary: 'Enviar un aviso a una audiencia de Socios' })
  @Auditable('ENVIAR_NOTIFICACION', 'EnvioNotificacion')
  crearEnvio(
    @Body() dto: CrearEnvioDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.crearEnvio(dto, user);
  }

  @Roles(TipoActor.GERENTE_GENERAL)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('envios/previsualizar')
  @ApiOperation({ summary: 'Cantidad de destinatarios de una audiencia' })
  previsualizar(@Query() query: PrevisualizarEnvioDto) {
    return this.service.previsualizar(query);
  }

  @Roles(TipoActor.GERENTE_GENERAL)
  @Get('envios')
  @ApiOperation({ summary: 'Historial de envíos (paginado, máx. 20)' })
  historial(@Query() query: NotificacionesQueryDto) {
    return this.service.historial(query);
  }
}
