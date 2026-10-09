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
  ValidationPipe,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ActualizarDniDto } from './dto/actualizar-dni.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { TipoActor } from 'src/entities';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { RechazarCamposSensibleInterceptor } from './interceptors/rechazar-campos-sensible.interceptor';
import { AsignarSedeDto } from './dto/asignar-sede.dto';
import { ReenviarVerificacionDto } from './dto/reenviar-verificacion.dto';
import { Throttle } from '@nestjs/throttler';
import { Auditable } from '../auditoria/decorators/auditable.decorator';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Usuarios')
@ApiCookieAuth('token')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Post('staff')
  @ApiOperation({ summary: 'Crear un usuario de staff' })
  @Auditable('CREAR_PERSONAL', 'Usuario')
  createStaff(
    @Body() dto: CreateUsuarioDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.crearStaff(dto, user);
  }
  // IMPORTANTE: 'staff' tiene que ir ANTES de ':id' en el archivo,
  // para que Nest no lo interprete como un parámetro.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Get('staff')
  @ApiOperation({ summary: 'Listar usuarios de staff' })
  findStaff(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.findStaff(query, user);
  }

  // Búsqueda para el mostrador (RECEPCIONISTA, GS, GG). Va ANTES de
  // ':id' para que Nest no la capture como parámetro.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  )
  // Tope de frecuencia propio: frena el barrido de la base letra por letra.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('buscar-clientes')
  @ApiOperation({
    summary:
      'Buscar socios y externos por nombre/apellido/DNI (mínimo 3 caracteres)',
  })
  buscarClientes(@Query('q') q?: string) {
    return this.usuariosService.buscarClientes(q ?? '');
  }

  // Públicos, sin guard — van ANTES de ':id' para que Nest no los
  // capture como parámetro.
  @Get('verificar-email')
  @ApiOperation({ summary: 'Confirmar email con el token del link' })
  verificarEmail(@Query('token') token: string) {
    return this.usuariosService.verificarEmail(token);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 reenvíos por minuto por IP
  @Post('reenviar-verificacion')
  @ApiOperation({ summary: 'Reenviar link de verificación de email' })
  reenviarVerificacion(@Body() dto: ReenviarVerificacionDto) {
    return this.usuariosService.reenviarVerificacion(dto.email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL)
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
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  create(
    @Body() dto: CreateUsuarioDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^(image\/jpeg|image\/png|image\/webp)$/,
          }),
        ],
      }),
    )
    foto?: Express.Multer.File,
  ) {
    return this.usuariosService.create(dto, foto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Get()
  @ApiOperation({ summary: 'Listar usuarios' })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.findAll(query, user);
  }

  @UseGuards(JwtAuthGuard) // sin RolesGuard: matriz de perfiles en el service
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.leerPerfil(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(RechazarCamposSensibleInterceptor)
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    // forbidNonWhitelisted: tipoActor/sedeId/dni (no declarados en el DTO)
    // se rechazan con 400 en vez de ignorarse en silencio.
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: UpdateUsuarioDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard) // sin RolesGuard: el propio usuario o staff (ownership abajo)
  @Patch(':id/foto')
  @ApiOperation({ summary: 'Actualizar foto de perfil de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  actualizarFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^(image\/jpeg|image\/png|image\/webp)$/,
          }),
        ],
      }),
    )
    foto: Express.Multer.File,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.actualizarFoto(id, foto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL)
  @Patch(':id/rol')
  @ApiOperation({ summary: 'Asignar rol a un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usuariosService.assignRole(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Patch(':id/dni')
  @ApiOperation({ summary: 'Actualizar el DNI de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  actualizarDni(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarDniDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.actualizarDni(id, dto.dni, user);
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
    await this.usuariosService.changePassword(
      id,
      dto.passwordActual,
      dto.password,
    );
    return { message: 'Contraseña actualizada' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Auditable('DESACTIVAR_USUARIO', 'Usuario')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosService.remove(id, user);
  }
}
