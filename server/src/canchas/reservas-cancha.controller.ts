import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ReservasCanchaService } from './reserva-cancha.service';
import { CreateReservaCanchaDto } from './dto/create-reserva-cancha.dto';

@Controller('reservas-cancha')
export class ReservasCanchaController {
  constructor(private readonly reservasService: ReservasCanchaService) {}

  @Post()
  reservar(@Body() dto: CreateReservaCanchaDto) {
    return this.reservasService.reservar(dto);
  }

  @Get('cancha/:canchaId')
  findPorCancha(
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.reservasService.findPorCancha(canchaId, fecha);
  }

  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservasService.cancelar(id);
  }
}
