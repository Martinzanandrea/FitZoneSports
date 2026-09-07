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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { ReservasCanchaService } from './reserva-cancha.service';
import { CreateReservaCanchaDto } from './dto/create-reserva-cancha.dto';
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

  @Get('cancha/:canchaId')
  @ApiOperation({ summary: 'Listar reservas de una cancha' })
  @ApiParam({ name: 'canchaId', description: 'UUID de la cancha' })
  @ApiQuery({ name: 'fecha', required: false, description: 'Fecha a consultar en formato ISO' })
  findPorCancha(
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.reservasService.findPorCancha(canchaId, fecha);
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
