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

@UseGuards(JwtAuthGuard, RolesGuard) // exige login para TODO el controller
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Roles(TipoActor.GERENTE)
  @Post()
  create(@Body() dto: CreateSedeDto) {
    return this.sedesService.create(dto);
  }

  @Get() // sin @Roles: cualquier usuario logueado (de cualquier rol) puede leer
  findAll() {
    return this.sedesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.findOne(id);
  }

  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSedeDto) {
    return this.sedesService.update(id, dto);
  }

  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.remove(id);
  }
}
