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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clases')
export class ClasesController {
  constructor(private readonly clasesService: ClasesService) {}

  @Roles(TipoActor.GERENTE)
  @Post()
  create(@Body() dto: CreateClaseDto) {
    return this.clasesService.create(dto);
  }

  @Get()
  findAll() {
    return this.clasesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clasesService.findOne(id);
  }

  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClaseDto) {
    return this.clasesService.update(id, dto);
  }

  // Acción acotada: reasignar instructor, distinta de update() completo.
  // Gerente sin restricción; Recepcionista solo en clases de su sede
  // (validado dentro del service con assertSedeScope).
  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Patch(':id/instructor')
  asignarInstructor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarInstructorDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.clasesService.asignarInstructor(id, dto.instructorId, user);
  }
}
