import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { ReservasClaseService } from './reserva-clase.service';
import { CreateReservaClaseDto } from './dto/create-reserva-clase.dto';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Reservas de clases')
@ApiCookieAuth('token')
@Controller('clases')
export class ReservasClaseController {
  constructor(private readonly reservasService: ReservasClaseService) {}

  @Post('ocurrencias/:ocurrenciaId/reservas')
  @ApiOperation({ summary: 'Reservar una ocurrencia de clase' })
  @ApiParam({ name: 'ocurrenciaId', description: 'UUID de la ocurrencia' })
  reservar(
    @Param('ocurrenciaId', ParseUUIDPipe) ocurrenciaId: string,
    @Body() dto: CreateReservaClaseDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, dto.usuarioId);
    return this.reservasService.reservar(ocurrenciaId, dto.usuarioId, user);
  }

  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Get('ocurrencias/:ocurrenciaId/reservas')
  @ApiOperation({ summary: 'Listar reservas de una ocurrencia (solo personal, con alcance por sede)' })
  @ApiParam({ name: 'ocurrenciaId', description: 'UUID de la ocurrencia' })
  findPorOcurrencia(
    @Param('ocurrenciaId', ParseUUIDPipe) ocurrenciaId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.findPorOcurrencia(ocurrenciaId, query, user);
  }

  // El id sale siempre del JWT: no hay parámetro de usuario.
  @Get('reservas/mias')
  @ApiOperation({ summary: 'Mis reservas de clases activas' })
  @ApiQuery({ name: 'desde', required: false, description: 'YYYY-MM-DD' })
  misReservas(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('desde') desde?: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.reservasService.misReservas(user.id, desde, query);
  }

  @Post('reservas/:reservaId/cancelar')
  @ApiOperation({ summary: 'Cancelar una reserva de clase' })
  @ApiParam({ name: 'reservaId', description: 'UUID de la reserva' })
  cancelar(
    @Param('reservaId', ParseUUIDPipe) reservaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.cancelar(reservaId, user);
  }
}
