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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { ReservasCanchaService } from './reserva-cancha.service';
import { CreateReservaCanchaDto } from './dto/create-reserva-cancha.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Reservas de canchas')
@ApiCookieAuth('token')
@Controller('reservas-cancha')
export class ReservasCanchaController {
  constructor(private readonly reservasService: ReservasCanchaService) {}

  @Post()
  @ApiOperation({ summary: 'Reservar una cancha' })
  reservar(
    @Body() dto: CreateReservaCanchaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, dto.usuarioId);
    return this.reservasService.reservar(dto, user);
  }

  @Post('cotizar')
  @ApiOperation({ summary: 'Cotizar una reserva de cancha' })
  cotizar(
    @Body() dto: CreateReservaCanchaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.cotizar(dto, user);
  }

  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Get('cancha/:canchaId')
  @ApiOperation({ summary: 'Listar reservas de una cancha (solo personal, con alcance por sede)' })
  @ApiParam({ name: 'canchaId', description: 'UUID de la cancha' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha a consultar en formato ISO' })
  findPorCancha(
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('fecha') fecha?: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.reservasService.findPorCancha(canchaId, fecha, query, user);
  }

  @Get('cancha/:canchaId/ocupacion')
  @ApiOperation({ summary: 'Franjas ocupadas de una cancha en una fecha (sin datos de usuarios)' })
  @ApiParam({ name: 'canchaId', description: 'UUID de la cancha' })
  @ApiQuery({ name: 'fecha', required: true, description: 'YYYY-MM-DD' })
  ocupacion(
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @Query('fecha') fecha: string,
  ) {
    return this.reservasService.ocupacion(canchaId, fecha);
  }

  // El id sale siempre del JWT: no hay parámetro de usuario.
  @Get('mias')
  @ApiOperation({ summary: 'Mis reservas de canchas confirmadas' })
  @ApiQuery({ name: 'fecha', required: false })
  @ApiQuery({ name: 'desde', required: false })
  misReservas(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('fecha') fecha?: string,
    @Query('desde') desde?: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.reservasService.misReservas(user.id, { fecha, desde }, query);
  }

  @Post(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar una reserva de cancha' })
  @ApiParam({ name: 'id', description: 'UUID de la reserva' })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.cancelar(id, user);
  }
}
