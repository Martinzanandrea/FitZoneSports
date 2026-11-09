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
import { PagosService } from './pagos.service';
import { HistorialPagosService } from './historial-pagos.service';
import {
  HistorialPagosQueryDto,
  MisPagosQueryDto,
} from './dto/historial-pagos-query.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { RegistrarPagoEfectivoDto } from './dto/registrar-pago-efectivo.dto';
import { CobrarCanchaPresencialDto } from './dto/cobrar-cancha-presencial.dto';
import { ClientesCobroQueryDto } from './dto/clientes-cobro-query.dto';
import { ReservasCanchaCobroQueryDto } from './dto/reservas-cancha-cobro-query.dto';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ROLES_CLIENTES, TODOS_LOS_ROLES } from '../auth/roles.constants';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Pagos')
@ApiCookieAuth('token')
@Controller('pagos')
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
    private readonly historial: HistorialPagosService,
  ) {}

  @Roles(...TODOS_LOS_ROLES)
  @Post('pasarela')
  @ApiOperation({ summary: 'Pagar mediante pasarela' })
  pagarConPasarela(
    @Body() dto: CreatePagoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, dto.usuarioId); // no podés pagar "en nombre de" otro socio, salvo staff
    // El personal que paga una membresía en nombre de otro queda acotado a su sede.
    if (user.id !== dto.usuarioId && dto.sedeAltaId) {
      assertSedeScope(user, dto.sedeAltaId);
    }
    return this.pagosService.pagarConPasarela(dto, user.id);
  }

  // Historial del personal. Va ANTES de ':id' para que no lo capture.
  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Get()
  @ApiOperation({
    summary:
      'Historial de pagos (paginado, filtros y totales; acotado a la sede salvo GG)',
  })
  historialPagos(
    @Query() query: HistorialPagosQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.historial.listar(query, user);
  }

  // Historial propio: el usuario sale del JWT, nunca de la URL ni del body.
  @Roles(...ROLES_CLIENTES)
  @Get('mias')
  @ApiOperation({ summary: 'Mis pagos (Socio y Externo)' })
  misPagos(
    @Query() query: MisPagosQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.historial.listarMios(query, user);
  }

  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Post(':id/comprobante')
  @ApiOperation({
    summary: 'Generar el comprobante de un pago aprobado que no lo tiene',
  })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @Auditable('GENERAR_COMPROBANTE', 'Pago')
  generarComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.generarComprobanteBajoDemanda(id, user);
  }

  // Rehace el PDF de un comprobante existente con el diseño actual, en el mismo
  // registro. Mismo alcance por sede que la generación.
  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  @Post(':id/comprobante/regenerar')
  @ApiOperation({
    summary: 'Regenerar el comprobante de un pago con el diseño actual',
  })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @Auditable('REGENERAR_COMPROBANTE', 'Pago')
  regenerarComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.generarComprobanteBajoDemanda(id, user, true);
  }

  // Cobro en efectivo: solo el Recepcionista (los gerentes no cobran).
  @Roles(TipoActor.RECEPCIONISTA)
  @Post('efectivo')
  @ApiOperation({ summary: 'Registrar un pago en efectivo' })
  @Auditable('COBRAR_EFECTIVO', 'Pago')
  registrarEfectivo(
    @Body() dto: RegistrarPagoEfectivoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.registrarPagoEfectivo(dto, user.id);
  }

  // Cobro presencial de cancha: crea la reserva y el pago en una operación.
  @Roles(TipoActor.RECEPCIONISTA)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('efectivo/cancha')
  @ApiOperation({
    summary:
      'Cobrar en el mostrador una cancha: crea la reserva y registra el pago en efectivo',
  })
  @Auditable('COBRAR_EFECTIVO_CANCHA', 'Pago')
  cobrarCanchaPresencial(
    @Body() dto: CobrarCanchaPresencialDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.cobrarCanchaPresencial(dto, user);
  }

  @Roles(TipoActor.RECEPCIONISTA)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('efectivo/clientes')
  @ApiOperation({
    summary: 'Clientes de la sede para cobrar en efectivo (paginado, con q)',
  })
  clientesEfectivo(
    @Query() query: ClientesCobroQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.listarClientesParaCobro(query, user);
  }

  @Roles(TipoActor.RECEPCIONISTA)
  @Get('efectivo/reservas-cancha')
  @ApiOperation({
    summary: 'Reservas de cancha de un cliente pendientes de cobro, en la sede',
  })
  reservasCanchaEfectivo(
    @Query() query: ReservasCanchaCobroQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.reservasCanchaParaCobro(query.usuarioId, user);
  }

  @Roles(...TODOS_LOS_ROLES)
  @Get('usuario/:usuarioId')
  @ApiOperation({ summary: 'Listar pagos de un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  findPorUsuario(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: any,
    @Query() query: PaginationQueryDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    assertOwnerOrStaff(user, usuarioId);
    return this.pagosService.findPorUsuario(usuarioId, query, user);
  }

  @Roles(...TODOS_LOS_ROLES)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un pago por ID' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.findOne(id, user);
  }
}
