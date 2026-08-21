import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccesoService } from './acceso.service';
import { ValidarQrDto } from './dto/validar-qr.dto';
import { RegistrarEgresoDto } from './dto/registrar-egreso.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('acceso')
export class AccesoController {
  constructor(private readonly accesoService: AccesoService) {}

  @Get('qr/:usuarioId')
  generarQr(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    return this.accesoService.generarQr(usuarioId);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post('validar')
  validarIngreso(@Body() dto: ValidarQrDto) {
    return this.accesoService.validarIngreso(dto.qrToken, dto.sedeId);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post('egreso')
  registrarEgreso(@Body() dto: RegistrarEgresoDto) {
    return this.accesoService.registrarEgreso(dto.usuarioId);
  }

  @Get('aforo/:sedeId') // sin ownership: es info de la sede, no de un usuario
  obtenerAforo(@Param('sedeId', ParseUUIDPipe) sedeId: string) {
    return this.accesoService.obtenerAforo(sedeId);
  }

  @Get('historial/:usuarioId')
  findHistorial(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    return this.accesoService.findHistorialPorUsuario(usuarioId);
  }
}
