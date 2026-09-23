import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { CanchasService } from './canchas.service';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Canchas')
@ApiCookieAuth('token')
@Controller('canchas')
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post()
  @ApiOperation({ summary: 'Crear una cancha' })
  @Auditable('CREAR_CANCHA', 'Cancha')
  create(@Body() dto: CreateCanchaDto) {
    return this.canchasService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Listar canchas' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.canchasService.findAll(query);
  }

  // Público, sin auth — catálogo para la landing. Va ANTES que ':id'
  // para que Nest no lo confunda con un parámetro. Sin @UseGuards
  // (mismo patrón que precios/membresias/publico): queda abierto.
  @Get('publico')
  @ApiOperation({ summary: 'Catálogo público de canchas activas por sede' })
  findAllPublico() {
    return this.canchasService.findAllPublico();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cancha por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la cancha' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.canchasService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una cancha' })
  @ApiParam({ name: 'id', description: 'UUID de la cancha' })
  @Auditable('ACTUALIZAR_CANCHA', 'Cancha')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCanchaDto) {
    return this.canchasService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post(':id/bloqueos')
  @ApiOperation({ summary: 'Crear un bloqueo de cancha' })
  @ApiParam({ name: 'id', description: 'UUID de la cancha' })
  @Auditable('BLOQUEAR_CANCHA', 'BloqueoCancha')
  crearBloqueo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBloqueoDto,
  ) {
    return this.canchasService.crearBloqueo(id, dto);
  }
}
