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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { AsignarSedeDto } from './dto/asignar-sede.dto';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Usuarios')
@ApiCookieAuth('token')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post('staff')
  @ApiOperation({ summary: 'Crear un usuario de staff' })
  @Auditable('CREAR_PERSONAL', 'Usuario')
  createStaff(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }
  // IMPORTANTE: 'staff' tiene que ir ANTES de ':id' en el archivo,
  // para que Nest no lo interprete como un parámetro.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Get('staff')
  @ApiOperation({ summary: 'Listar usuarios de staff' })
  findStaff() {
    return this.usuariosService.findStaff();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id/sede')
  @ApiOperation({ summary: 'Asignar una sede a un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Auditable('REASIGNAR_SEDE', 'Usuario')
  asignarSede(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarSedeDto,
  ) {
    return this.usuariosService.asignarSede(id, dto.sedeId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un usuario' })
  @UseInterceptors(FileInterceptor('foto'))
  create(
    @Body() dto: CreateUsuarioDto,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.usuariosService.create(dto, foto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Get()
  @ApiOperation({ summary: 'Listar usuarios' })
  findAll() {
    return this.usuariosService.findAll();
  }

  @UseGuards(JwtAuthGuard) // sin RolesGuard: cualquier logueado, se valida ownership abajo
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    assertOwnerOrStaff(user, id);
    return this.usuariosService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: any,
  ) {
    assertOwnerOrStaff(user, id);
    return this.usuariosService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id/rol')
  @ApiOperation({ summary: 'Asignar rol a un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usuariosService.assignRole(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/password')
  @ApiOperation({ summary: 'Cambiar contraseña de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  async changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: any,
  ) {
    assertOwnerOrStaff(user, id);
    await this.usuariosService.changePassword(id, dto.password);
    return { message: 'Contraseña actualizada' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Auditable('DESACTIVAR_USUARIO', 'Usuario')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.remove(id);
  }
}
