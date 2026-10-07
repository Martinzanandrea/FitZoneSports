import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { TipoActor } from '../entities/enums';
import { ClasesService } from './clases.service';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';
import { AsignarInstructorDto } from './dto/asignar-instructor.dto';
import { RepartoHorasService } from './reparto-horas.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Clases')
@ApiCookieAuth('token')
@Controller('clases')
export class ClasesController {
  constructor(
    private readonly clasesService: ClasesService,
    private readonly repartoService: RepartoHorasService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Post()
  @ApiOperation({ summary: 'Crear una clase con su grilla semanal' })
  @Auditable('CREAR_CLASE', 'Clase')
  create(
    @Body() dto: CreateClaseDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.clasesService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Post(':id/generar-ocurrencias')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar ocurrencias faltantes de una clase (idempotente)' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  generarOcurrencias(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.clasesService.generarOcurrencias(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Listar clases (filtrable por sede)' })
  findAll(
    @Query('sedeId') sedeId?: string,
    @Query() query?: PaginationQueryDto,
    @CurrentUser() user?: UsuarioAutenticado,
  ) {
    return this.clasesService.findAll(sedeId, query, user);
  }

  // Va ANTES que ':id' para que Nest no lo confunda con un ID.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Get('reparto-sugerido')
  @ApiOperation({
    summary: 'Sugerir días y horarios para una carga horaria (no persiste nada)',
  })
  sugerirReparto(
    @Query('sedeId', ParseUUIDPipe) sedeId: string,
    @Query('horasSemanales', ParseFloatPipe) horasSemanales: number,
    @Query('numDias', ParseIntPipe) numDias: number,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (user?.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!user?.sedeId) {
        throw new ForbiddenException('No tenés sede asignada');
      }
      assertSedeScope(user, sedeId);
    }
    return this.repartoService.sugerir(sedeId, horasSemanales, numDias);
  }

  // Público, sin auth — resumen agregado para la landing. Va ANTES
  // que ':id' para que Nest no lo confunda con un parámetro. Sin
  // @UseGuards (mismo patrón que precios/membresias/publico).
  @Get('publico')
  @ApiOperation({ summary: 'Resumen público de tipos de clase (agregado por tipo)' })
  resumenPublico() {
    return this.clasesService.resumenPublico();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una clase por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clasesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/ocurrencias')
  @ApiOperation({ summary: 'Listar ocurrencias de una clase (filtrable por fechas)' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  listarOcurrencias(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.clasesService.listarOcurrencias(id, desde, hasta, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tipo, instructor o capacidad de una clase' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  @Auditable('ACTUALIZAR_CLASE', 'Clase')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClaseDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.clasesService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una clase (no borra ocurrencias ni reservas)' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  @Auditable('DESACTIVAR_CLASE', 'Clase')
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.clasesService.desactivar(id, user);
  }

  // Acción acotada: reasignar instructor, distinta de update() completo.
  // GG y GS con scope a la sede de la clase (validado dentro del service
  // con assertSedeScope). RECEPCIONISTA ya no accede.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Patch(':id/instructor')
  @ApiOperation({ summary: 'Asignar instructor a una clase' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  @Auditable('ASIGNAR_INSTRUCTOR', 'Clase')
  asignarInstructor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarInstructorDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.clasesService.asignarInstructor(id, dto.instructorId, user);
  }
}
