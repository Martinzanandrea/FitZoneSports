import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ValidarDniDto } from './dto/validar-dni.dto';
import { SincronizarAccesoDto } from './dto/sincronizar-acceso.dto';
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
import { Throttle } from '@nestjs/throttler';
import { Auditable } from '../auditoria/decorators/auditable.decorator';

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

  // El terminal verifica el QR sin servidor con esta clave pública (JWK).
  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE)
  @Get('clave-publica')
  @ApiOperation({ summary: 'Clave pública ES256 con la que se firma el QR' })
  obtenerClavePublica() {
    return this.accesoService.obtenerClavePublica();
  }

  // Datos de la sede para validar QR sin conexión durante 24 h.
  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE)
  @Auditable('DESCARGA_SNAPSHOT_ACCESO', 'Sede')
  @Get('snapshot/:sedeId')
  @ApiOperation({ summary: 'Snapshot de acceso de una sede para uso offline' })
  @ApiParam({ name: 'sedeId', description: 'UUID de la sede' })
  obtenerSnapshot(
    @Param('sedeId', ParseUUIDPipe) sedeId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.obtenerSnapshot(sedeId, user);
  }

  // Ingresos que el terminal registró sin conexión. Un resultado por evento,
  // en el orden del request; los fallos por evento van dentro del 200.
  @Roles(TipoActor.RECEPCIONISTA)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Auditable('SINCRONIZACION_ACCESO_OFFLINE', 'ControlAcceso')
  @Post('sincronizar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sincronizar ingresos registrados offline' })
  sincronizar(
    @Body() dto: SincronizarAccesoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.sincronizarIngresosOffline(
      dto.sedeId,
      dto.eventos,
      user,
    );
  }

  // Ingreso manual por DNI: alternativa cuando el socio no puede mostrar su QR.
  // Queda en la auditoría como INGRESO_MANUAL_DNI, con el actor que lo hizo.
  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Auditable('INGRESO_MANUAL_DNI', 'ControlAcceso')
  @Post('validar-dni')
  @ApiOperation({ summary: 'Registrar el ingreso de un socio por DNI' })
  validarDni(
    @Body() dto: ValidarDniDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.validarDni(dto.dni, dto.sedeId, user);
  }

  // Previsualización previa a confirmar: solo nombre, foto y estado.
  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('buscar-dni')
  @ApiOperation({
    summary: 'Buscar un socio por DNI (nombre, foto y estado de membresía)',
  })
  buscarDni(
    @Body() dto: ValidarDniDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.accesoService.buscarPorDni(dto.dni, dto.sedeId, user);
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
