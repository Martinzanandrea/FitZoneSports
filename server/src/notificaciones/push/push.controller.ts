import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../../auth/types/usuario-autenticado.type';
import { TipoActor } from '../../entities/enums';
import { PushSuscripcionesService } from './push-suscripciones.service';
import { DesuscribirPushDto, SuscribirPushDto } from './push.dto';

// Cualquier usuario autenticado gestiona SOLO sus propias suscripciones.
const TODOS_LOS_ROLES = Object.values(TipoActor);

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Notificaciones push')
@ApiCookieAuth('token')
@Controller('notificaciones/push')
export class PushController {
  constructor(private readonly service: PushSuscripcionesService) {}

  @Roles(...TODOS_LOS_ROLES)
  @Get('clave-publica')
  @ApiOperation({ summary: 'Clave pública VAPID (503 si no está configurada)' })
  clavePublica() {
    return this.service.obtenerClavePublica();
  }

  @Roles(...TODOS_LOS_ROLES)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('suscripcion')
  @ApiOperation({ summary: 'Registrar (o reasignar) mi suscripción push' })
  suscribir(
    @Body() dto: SuscribirPushDto,
    @CurrentUser() user: UsuarioAutenticado,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.suscribir(user.id, dto, userAgent);
  }

  @Roles(...TODOS_LOS_ROLES)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Delete('suscripcion')
  @HttpCode(200)
  @ApiOperation({ summary: 'Borrar mi suscripción push (solo si es mía)' })
  desuscribir(
    @Body() dto: DesuscribirPushDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.desuscribir(user.id, dto.endpoint);
  }
}
