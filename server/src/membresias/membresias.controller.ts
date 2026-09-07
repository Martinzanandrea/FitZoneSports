import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Membresías')
@ApiCookieAuth('token')
@Controller('membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una membresía' })
  create(
    @Body() dto: CreateMembresiaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, dto.usuarioId);
    return this.membresiasService.create(dto);
  }

  @Post('renovar')
  @ApiOperation({ summary: 'Renovar una membresía' })
  renovar(@Body() dto: CreateMembresiaDto, @CurrentUser() user: UsuarioAutenticado) {
    assertOwnerOrStaff(user, dto.usuarioId);
    return this.membresiasService.renovar(dto);
  }

  // Debe ir ANTES que ':id' para que Nest no lo confunda con un parámetro.
  @Get('vigente/:usuarioId')
  @ApiOperation({ summary: 'Obtener la membresía vigente de un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  vigente(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    assertOwnerOrStaff(user, usuarioId);
    return this.membresiasService.obtenerMembresiaVigente(usuarioId);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Get()
  @ApiOperation({ summary: 'Listar membresías' })
  findAll() {
    return this.membresiasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una membresía por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const membresia = await this.membresiasService.findOne(id);
    assertOwnerOrStaff(user, membresia.usuario.id);
    return membresia;
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una membresía' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembresiaDto,
  ) {
    return this.membresiasService.update(id, dto);
  }

  @Roles(TipoActor.GERENTE)
  @Post('marcar-vencidas')
  @ApiOperation({ summary: 'Marcar membresías vencidas' })
  async marcarVencidas() {
    const cantidad = await this.membresiasService.marcarVencidasSiCorresponde();
    return { message: `${cantidad} membresía(s) marcadas como vencidas` };
  }

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
    return this.membresiasService.cancelar(id);
  }
}
