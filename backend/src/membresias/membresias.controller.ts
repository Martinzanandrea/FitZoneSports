import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { MembresiasService } from './membresias.service';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TODOS_LOS_ROLES } from '../auth/roles.constants';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Membresías')
@ApiCookieAuth('token')
@Controller('membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  // No hay POST /membresias ni POST /membresias/renovar: una membresía solo
  // nace (o se renueva) junto con un pago APROBADO, en la misma transacción.
  // Se contrata con POST /pagos/pasarela o POST /pagos/efectivo.

  // Debe ir ANTES que ':id' para que Nest no lo confunda con un parámetro.
  @Roles(...TODOS_LOS_ROLES)
  @Get('vigente/:usuarioId')
  @ApiOperation({ summary: 'Obtener el estado de membresía de un usuario (solo lectura)' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  vigente(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    return this.membresiasService.obtenerEstadoSocio(usuarioId);
  }

  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Get()
  @ApiOperation({ summary: 'Listar membresías' })
  findAll(@CurrentUser() user: UsuarioAutenticado, @Query() query: PaginationQueryDto) {
    return this.membresiasService.findAll(user, query);
  }

  @Roles(...TODOS_LOS_ROLES)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una membresía por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const membresia = await this.membresiasService.findOne(id);
    assertOwnerOrStaff(user, membresia.usuario.id);
    // El personal de sede solo ve membresías dadas de alta en su sede.
    if (user.id !== membresia.usuario.id) {
      assertSedeScope(user, membresia.sedeAlta.id);
    }
    return membresia;
  }

  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una membresía' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembresiaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.membresiasService.update(id, dto, user);
  }

  @Roles(TipoActor.GERENTE_GENERAL)
  @Post('marcar-vencidas')
  @ApiOperation({ summary: 'Marcar membresías vencidas' })
  async marcarVencidas() {
    const cantidad = await this.membresiasService.marcarVencidasSiCorresponde();
    return { message: `${cantidad} membresía(s) marcadas como vencidas` };
  }

  @Roles(TipoActor.SOCIO, TipoActor.EXTERNO, TipoActor.GERENTE_SEDE, TipoActor.GERENTE_GENERAL)
  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar una membresía' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  @Auditable('CANCELAR_MEMBRESIA', 'Membresia')
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const membresia = await this.membresiasService.findOne(id);
    assertOwnerOrStaff(user, membresia.usuario.id);
    return this.membresiasService.cancelar(id, user);
  }
}
