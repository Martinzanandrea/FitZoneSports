import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ReservasClaseService } from './reserva-clase.service';
import { CreateReservaClaseDto } from './dto/create-reserva-clase.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from 'src/auth/types/usuario-autenticado.type';

@Controller('clases')
export class ReservasClaseController {
  constructor(private readonly reservasService: ReservasClaseService) {}

  @Post(':claseId/reservas')
  reservar(
    @Param('claseId', ParseUUIDPipe) claseId: string,
    @Body() dto: CreateReservaClaseDto,
  ) {
    return this.reservasService.reservar(claseId, dto.usuarioId);
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
