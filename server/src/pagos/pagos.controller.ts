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
import { CreatePagoDto } from './dto/create-pago.dto';
import { RegistrarPagoEfectivoDto } from './dto/registrar-pago-efectivo.dto';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
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
  constructor(private readonly pagosService: PagosService) {}

  @Post('pasarela')
  @ApiOperation({ summary: 'Pagar mediante pasarela' })
  pagarConPasarela(@Body() dto: CreatePagoDto, @CurrentUser() user: any) {
    assertOwnerOrStaff(user, dto.usuarioId); // no podés pagar "en nombre de" otro socio, salvo staff
    return this.pagosService.pagarConPasarela(dto);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post('efectivo')
  @ApiOperation({ summary: 'Registrar un pago en efectivo' })
  @Auditable('COBRAR_EFECTIVO', 'Pago')
  registrarEfectivo(
    @Body() dto: RegistrarPagoEfectivoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.pagosService.registrarPagoEfectivo(dto, user.id);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Get('efectivo/opciones')
  @ApiOperation({ summary: 'Obtener opciones para cobro en efectivo' })
  opcionesEfectivo(@CurrentUser() user: UsuarioAutenticado) {
    return this.pagosService.obtenerOpcionesCobro(user);
  }

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
    return this.pagosService.findPorUsuario(usuarioId, query);
  }

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
