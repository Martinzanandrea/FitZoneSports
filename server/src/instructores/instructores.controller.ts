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

@UseGuards(JwtAuthGuard, RolesGuard) // exige login para TODO el controller
@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructoresService: InstructoresService) {}

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post()
  create(@Body() dto: CreateInstructorDto) {
    return this.instructoresService.create(dto);
  }

  @Get() // sin @Roles: cualquier usuario logueado puede leer
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

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructoresService.remove(id);
  }
}
