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
import { CanchasService } from './canchas.service';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('canchas')
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}

  @Roles(TipoActor.GERENTE)
  @Post()
  create(@Body() dto: CreateCanchaDto) {
    return this.canchasService.create(dto);
  }

  @Get()
  findAll() {
    return this.canchasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.canchasService.findOne(id);
  }

  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCanchaDto) {
    return this.canchasService.update(id, dto);
  }

  @Roles(TipoActor.GERENTE)
  @Post(':id/bloqueos')
  crearBloqueo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBloqueoDto,
  ) {
    return this.canchasService.crearBloqueo(id, dto);
  }
}
