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
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

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
