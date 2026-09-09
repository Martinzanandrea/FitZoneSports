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
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { SedesService } from './sedes.service';
import { FranjasHorariasService } from './franjas-horarias.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateFranjaDto } from './dto/create-franja.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';


@ApiTags('Sedes')
@Controller('sedes')
export class SedesController {
  //sedesService is injected into the controller to handle business logic related to "sedes" (locations/branches).
  constructor(
    private readonly sedesService: SedesService,
    private readonly franjasService: FranjasHorariasService,
  ) {}

  // Público, sin auth — usado por la landing/página de inicio.
  @Get('publico')
  @ApiOperation({summary: 'Obtener todas las sedes disponibles para el público en general'})
  @ApiResponse({status: 200, description: 'Lista de sedes obtenida exitosamente'})
  
  findAllPublico() {
    return this.sedesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post()
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Crear una nueva sede'})
  @ApiResponse({status: 201, description: 'Sede creada exitosamente'})
  @ApiResponse({status: 400, description: 'Datos inválidos para crear la sede'})
  @ApiResponse({status: 401, description: 'No autorizado'})
  @ApiResponse({status: 403, description: 'Acceso prohibido'})
  @Auditable('CREAR_SEDE', 'Sede')
  create(@Body() dto: CreateSedeDto) {
    return this.sedesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Obtener todas las sedes'})
  @ApiResponse({status: 200, description: 'Lista de sedes obtenida exitosamente'})
  @ApiResponse({status: 401, description: 'No autorizado'})
  @ApiResponse({status: 403, description: 'Acceso prohibido'})
  findAll() {
    return this.sedesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Obtener una sede por su ID'})
  @ApiParam({name: 'id', description: 'ID de la sede', type: 'string'})
  @ApiResponse({status: 200, description: 'Sede obtenida exitosamente'})
  @ApiResponse({status: 404, description: 'Sede no encontrada'})
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Actualizar una sede por su ID'})
  @ApiParam({name: 'id', description: 'ID de la sede', type: 'string'})
  @ApiResponse({status: 200, description: 'Sede actualizada exitosamente'})
  @ApiResponse({status: 404, description: 'Sede no encontrada'})
 @ApiResponse({ status: 403, description: 'Se requiere rol GERENTE' })
  @Auditable('ACTUALIZAR_SEDE', 'Sede')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSedeDto) {
    return this.sedesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Eliminar una sede por su ID'})
  @ApiParam({name: 'id', description: 'ID de la sede', type: 'string'})
  @ApiResponse({status: 200, description: 'Sede eliminada exitosamente'})
  @ApiResponse({status: 404, description: 'Sede no encontrada'})
  @ApiResponse({ status: 403, description: 'Se requiere rol GERENTE' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.remove(id);
  }

  // Franjas horarias de la sede (parte del recurso "sede").
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/franjas')
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Listar las franjas horarias de una sede'})
  @ApiParam({name: 'id', description: 'ID de la sede', type: 'string'})
  @ApiResponse({status: 200, description: 'Lista de franjas obtenida exitosamente'})
  @ApiResponse({status: 404, description: 'Sede no encontrada'})
  listarFranjas(@Param('id', ParseUUIDPipe) id: string) {
    return this.franjasService.listarPorSede(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post(':id/franjas')
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Crear una franja horaria en una sede'})
  @ApiParam({name: 'id', description: 'ID de la sede', type: 'string'})
  @ApiResponse({status: 201, description: 'Franja creada exitosamente'})
  @ApiResponse({status: 400, description: 'Datos inválidos para crear la franja'})
  @ApiResponse({status: 403, description: 'Se requiere rol GERENTE'})
  crearFranja(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFranjaDto,
  ) {
    return this.franjasService.crear(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Delete(':id/franjas/:franjaId')
  @ApiCookieAuth('token')
  @ApiOperation({summary: 'Eliminar una franja horaria de una sede'})
  @ApiParam({name: 'id', description: 'ID de la sede', type: 'string'})
  @ApiParam({name: 'franjaId', description: 'ID de la franja', type: 'string'})
  @ApiResponse({status: 200, description: 'Franja eliminada exitosamente'})
  @ApiResponse({status: 404, description: 'Sede o franja no encontrada'})
  @ApiResponse({status: 403, description: 'Se requiere rol GERENTE'})
  async eliminarFranja(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('franjaId', ParseUUIDPipe) franjaId: string,
  ) {
    await this.franjasService.eliminar(id, franjaId);
    return { message: 'Franja eliminada' };
  }
}
