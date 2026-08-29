import {
  Body,
  Controller,
  Delete,
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
import { InstructoresService } from './instructores.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructoresService: InstructoresService) {}

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post()
  @Auditable('CREAR_INSTRUCTOR', 'Instructor')
  create(@Body() dto: CreateInstructorDto) {
    return this.instructoresService.create(dto);
  }

  @Get()
  findAll() {
    return this.instructoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructoresService.findOne(id);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstructorDto,
  ) {
    return this.instructoresService.update(id, dto);
  }

  // El borrado (baja lógica) queda exclusivo de Gerente — dar de baja
  // un instructor es una decisión más sensible que darlo de alta.
  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructoresService.remove(id);
  }
}
