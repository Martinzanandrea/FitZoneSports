import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { TipoActor } from '../entities/enums';
import { ClasesService } from './clases.service';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';
import { AsignarInstructorDto } from './dto/asignar-instructor.dto';
import { RepartoHorasService } from './reparto-horas.service';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Clases')
@ApiCookieAuth('token')
@Controller('clases')
export class ClasesController {
  constructor(
    private readonly clasesService: ClasesService,
    private readonly repartoService: RepartoHorasService,
  ) {}

  @Roles(TipoActor.GERENTE)
  @Post()
  @ApiOperation({ summary: 'Crear una clase con su grilla semanal' })
  @Auditable('CREAR_CLASE', 'Clase')
  create(@Body() dto: CreateClaseDto) {
    return this.clasesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clases (filtrable por sede)' })
  findAll(@Query('sedeId') sedeId?: string) {
    return this.clasesService.findAll(sedeId);
  }

  // Va ANTES que ':id' para que Nest no lo confunda con un ID.
  @Roles(TipoActor.GERENTE)
  @Get('reparto-sugerido')
  @ApiOperation({
    summary: 'Sugerir días y horarios para una carga horaria (no persiste nada)',
  })
  sugerirReparto(
    @Query('sedeId', ParseUUIDPipe) sedeId: string,
    @Query('horasSemanales', ParseFloatPipe) horasSemanales: number,
    @Query('numDias', ParseIntPipe) numDias: number,
  ) {
    return this.repartoService.sugerir(sedeId, horasSemanales, numDias);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una clase por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clasesService.findOne(id);
  }

  @Get(':id/ocurrencias')
  @ApiOperation({ summary: 'Listar ocurrencias de una clase (filtrable por fechas)' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  listarOcurrencias(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.clasesService.listarOcurrencias(id, desde, hasta);
  }

  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tipo, instructor o capacidad de una clase' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  @Auditable('ACTUALIZAR_CLASE', 'Clase')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClaseDto) {
    return this.clasesService.update(id, dto);
  }

  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar una clase (no borra ocurrencias ni reservas)' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  @Auditable('DESACTIVAR_CLASE', 'Clase')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.clasesService.desactivar(id);
  }

  // Acción acotada: reasignar instructor, distinta de update() completo.
  // Gerente sin restricción; Recepcionista solo en clases de su sede
  // (validado dentro del service con assertSedeScope).
  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
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
