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
import { AccesoService } from './acceso.service';
import { ValidarQrDto } from './dto/validar-qr.dto';
import { RegistrarEgresoDto } from './dto/registrar-egreso.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from 'src/auth/types/usuario-autenticado.type';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Acceso')
@ApiCookieAuth('token')
@Controller('acceso')
export class AccesoController {
  constructor(private readonly accesoService: AccesoService) {}

  @Get('qr/:usuarioId')
  @ApiOperation({ summary: 'Generar QR de acceso para un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  generarQr(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    return this.accesoService.generarQr(usuarioId);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post('validar')
  @ApiOperation({ summary: 'Validar ingreso mediante QR' })
  validarIngreso(
    @Body() dto: ValidarQrDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.validarIngreso(dto.qrToken, dto.sedeId, user);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post('egreso')
  @ApiOperation({ summary: 'Registrar egreso de un usuario' })
  registrarEgreso(
    @Body() dto: RegistrarEgresoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.registrarEgreso(dto.usuarioId, user);
  }

  @Get('aforo/:sedeId') // sin ownership: es info de la sede, no de un usuario
  @ApiOperation({ summary: 'Consultar aforo actual de una sede' })
  @ApiParam({ name: 'sedeId', description: 'UUID de la sede' })
  obtenerAforo(@Param('sedeId', ParseUUIDPipe) sedeId: string) {
    return this.accesoService.obtenerAforo(sedeId);
  }

  @Get('historial/:usuarioId')
  @ApiOperation({ summary: 'Consultar historial de acceso de un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  findHistorial(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
    @Query() query: PaginationQueryDto,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    return this.accesoService.findHistorialPorUsuario(usuarioId, query);
  }
}
