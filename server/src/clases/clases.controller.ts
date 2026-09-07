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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { TipoActor } from '../entities/enums';
import { ClasesService } from './clases.service';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';
import { AsignarInstructorDto } from './dto/asignar-instructor.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Clases')
@ApiCookieAuth('token')
@Controller('clases')
export class ClasesController {
  constructor(private readonly clasesService: ClasesService) {}

  @Roles(TipoActor.GERENTE)
  @Post()
  @ApiOperation({ summary: 'Crear una clase' })
  @Auditable('CREAR_CLASE', 'Clase')
  create(@Body() dto: CreateClaseDto) {
    return this.clasesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clases' })
  findAll() {
    return this.clasesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una clase por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clasesService.findOne(id);
  }

  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una clase' })
  @ApiParam({ name: 'id', description: 'UUID de la clase' })
  @Auditable('ACTUALIZAR_CLASE', 'Clase')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClaseDto) {
    return this.clasesService.update(id, dto);
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
