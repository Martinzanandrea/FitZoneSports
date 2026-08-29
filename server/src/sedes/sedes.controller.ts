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
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';

@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  // Público, sin auth — usado por la landing/página de inicio.
  // Va ANTES que ':id' para que Nest no lo confunda con un parámetro.
  @Get('publico')
  findAllPublico() {
    return this.sedesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post()
  @Auditable('CREAR_SEDE', 'Sede')
  create(@Body() dto: CreateSedeDto) {
    return this.sedesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  findAll() {
    return this.sedesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  @Auditable('ACTUALIZAR_SEDE', 'Sede')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSedeDto) {
    return this.sedesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.remove(id);
  }
}
