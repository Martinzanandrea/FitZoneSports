import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { RegistrarPagoEfectivoDto } from './dto/registrar-pago-efectivo.dto';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('pasarela')
  pagarConPasarela(@Body() dto: CreatePagoDto, @CurrentUser() user: any) {
    assertOwnerOrStaff(user, dto.usuarioId); // no podés pagar "en nombre de" otro socio, salvo staff
    return this.pagosService.pagarConPasarela(dto);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post('efectivo')
  registrarEfectivo(
    @Body() dto: RegistrarPagoEfectivoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.registrarPagoEfectivo(dto, user.id);
  }

  @Get('usuario/:usuarioId')
  findPorUsuario(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    assertOwnerOrStaff(user, usuarioId);
    return this.pagosService.findPorUsuario(usuarioId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.findOne(id, user);
  }
}
