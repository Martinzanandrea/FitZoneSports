import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { InstructoresService } from './instructores.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Instructores')
@ApiCookieAuth('token')
@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructoresService: InstructoresService) {}

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post()
  @ApiOperation({ summary: 'Crear un instructor' })
  @Auditable('CREAR_INSTRUCTOR', 'Instructor')
  create(@Body() dto: CreateInstructorDto) {
    return this.instructoresService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar instructores' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.instructoresService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un instructor por ID' })
  @ApiParam({ name: 'id', description: 'UUID del instructor' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructoresService.findOne(id);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un instructor' })
  @ApiParam({ name: 'id', description: 'UUID del instructor' })
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
  @ApiOperation({ summary: 'Dar de baja un instructor' })
  @ApiParam({ name: 'id', description: 'UUID del instructor' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructoresService.remove(id);
  }
}
