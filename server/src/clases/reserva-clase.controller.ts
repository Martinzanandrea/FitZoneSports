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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clases')
export class ReservasClaseController {
  constructor(private readonly reservasService: ReservasClaseService) {}

  @Post(':claseId/reservas')
  reservar(
    @Param('claseId', ParseUUIDPipe) claseId: string,
    @Body() dto: CreateReservaClaseDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, dto.usuarioId);
    return this.reservasService.reservar(claseId, dto.usuarioId, user);
  }

  @Get(':claseId/reservas')
  findPorClase(@Param('claseId', ParseUUIDPipe) claseId: string) {
    return this.reservasService.findPorClase(claseId);
  }

  @Post('reservas/:reservaId/cancelar')
  cancelar(
    @Param('reservaId', ParseUUIDPipe) reservaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.reservasService.cancelar(reservaId, user);
  }
}
