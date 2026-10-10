import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AccesoService } from './acceso.service';
import { ValidarQrDto } from './dto/validar-qr.dto';
import { ValidarCodigoDto } from './dto/validar-codigo.dto';
import { RegistrarEgresoDto } from './dto/registrar-egreso.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TipoActor } from 'src/entities';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { Roles } from 'src/auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from 'src/auth/types/usuario-autenticado.type';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TODOS_LOS_ROLES } from '../auth/roles.constants';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Acceso')
@ApiCookieAuth('token')
@Controller('acceso')
export class AccesoController {
  constructor(private readonly accesoService: AccesoService) {}

  @Roles(TipoActor.SOCIO)
  @Get('qr/:usuarioId')
  @ApiOperation({ summary: 'Generar QR de acceso para un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  generarQr(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
  ) {
    // El QR es la llave de entrada: solo el propio socio lo genera. Ni el
    // personal puede pedir uno a nombre de otra persona.
    if (user.id !== usuarioId) {
      throw new ForbiddenException('Solo podés generar tu propio QR');
    }
    return this.accesoService.generarQr(usuarioId);
  }

  @Roles(TipoActor.RECEPCIONISTA) // escanear y registrar: solo el mostrador
  @Post('validar')
  @ApiOperation({ summary: 'Validar ingreso mediante QR' })
  validarIngreso(
    @Body() dto: ValidarQrDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.validarIngreso(dto.qrToken, dto.sedeId, user);
  }

  @Roles(TipoActor.RECEPCIONISTA) // escanear y registrar: solo el mostrador
  @Post('validar-codigo')
  @ApiOperation({
    summary: 'Validar ingreso mediante código corto de 6 dígitos',
  })
  validarCodigo(
    @Body() dto: ValidarCodigoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.validarCodigo(dto.codigo, dto.sedeId, user);
  }

  @Roles(TipoActor.RECEPCIONISTA) // escanear y registrar: solo el mostrador
  @Post('egreso')
  @ApiOperation({ summary: 'Registrar egreso de un usuario' })
  registrarEgreso(
    @Body() dto: RegistrarEgresoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.registrarEgreso(dto.usuarioId, user);
  }

  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Get('resumen')
  @ApiOperation({
    summary: 'Obtener resumen de accesos por sede (solo lectura)',
  })
  obtenerResumenAccesos(@CurrentUser() user: UsuarioAutenticado) {
    return this.accesoService.obtenerResumenAccesos(user);
  }

  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Get('aforo/:sedeId')
  @ApiOperation({ summary: 'Consultar aforo actual de una sede' })
  @ApiParam({ name: 'sedeId', description: 'UUID de la sede' })
  obtenerAforo(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertSedeScope(user, sedeId); // RECEP y GS: solo su sede; GG: todas
    return this.accesoService.obtenerAforo(sedeId);
  }

  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Get('dentro/:sedeId')
  @ApiOperation({ summary: 'Listar usuarios actualmente dentro de una sede' })
  @ApiParam({ name: 'sedeId', description: 'UUID de la sede' })
  listarDentro(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: PaginationQueryDto,
  ) {
    return this.accesoService.listarDentro(sedeId, user, query);
  }

  @Roles(...TODOS_LOS_ROLES)
  @Get('historial/:usuarioId')
  @ApiOperation({ summary: 'Consultar historial de acceso de un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  findHistorial(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
    @Query() query: PaginationQueryDto,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    // El personal de sede solo ve los ingresos a SU sede (el GG, todos).
    let sedeId: string | undefined;
    if (user.id !== usuarioId && user.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!user.sedeId) throw new ForbiddenException('No tenés sede asignada');
      sedeId = user.sedeId;
    }
    return this.accesoService.findHistorialPorUsuario(usuarioId, query, sedeId);
  }
}
