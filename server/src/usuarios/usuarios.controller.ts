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
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post('staff')
  createStaff(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }
  // IMPORTANTE: 'staff' tiene que ir ANTES de ':id' en el archivo,
  // para que Nest no lo interprete como un parámetro.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Get('staff')
  findStaff() {
    return this.usuariosService.findStaff();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id/sede')
  asignarSede(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarSedeDto,
  ) {
    return this.usuariosService.asignarSede(id, dto.sedeId);
  }

  @Post()
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
  findAll() {
    return this.usuariosService.findAll();
  }

  @UseGuards(JwtAuthGuard) // sin RolesGuard: cualquier logueado, se valida ownership abajo
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    assertOwnerOrStaff(user, id);
    return this.usuariosService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
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
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usuariosService.assignRole(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/password')
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
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.remove(id);
  }
}
