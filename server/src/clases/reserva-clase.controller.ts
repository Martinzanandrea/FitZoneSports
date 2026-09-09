import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { ReservasClaseService } from './reserva-clase.service';
import { CreateReservaClaseDto } from './dto/create-reserva-clase.dto';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

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

  @Get('ocurrencias/:ocurrenciaId/reservas')
  @ApiOperation({ summary: 'Listar reservas de una ocurrencia' })
  @ApiParam({ name: 'ocurrenciaId', description: 'UUID de la ocurrencia' })
  findPorOcurrencia(
    @Param('ocurrenciaId', ParseUUIDPipe) ocurrenciaId: string,
  ) {
    return this.reservasService.findPorOcurrencia(ocurrenciaId);
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
