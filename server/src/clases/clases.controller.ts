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
import { ClasesService } from './clases.service';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clases')
export class ClasesController {
  constructor(private readonly clasesService: ClasesService) {}

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
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

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClaseDto) {
    return this.clasesService.update(id, dto);
  }
}
