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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservas-cancha')
export class ReservasCanchaController {
  constructor(private readonly reservasService: ReservasCanchaService) {}

  @Post()
  reservar(
    @Body() dto: CreateReservaCanchaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, dto.usuarioId);
    return this.reservasService.reservar(dto, user);
  }

  @Post('cotizar')
  cotizar(
    @Body() dto: CreateReservaCanchaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.cotizar(dto, user);
  }

  @Get('cancha/:canchaId')
  findPorCancha(
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.reservasService.findPorCancha(canchaId, fecha);
  }

  @Post(':id/cancelar')
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.cancelar(id, user);
  }
}
