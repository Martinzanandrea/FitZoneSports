import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { TiposCanchaService } from './tipos-cancha.service';
import { CreateTipoCanchaDto } from './dto/create-tipo-cancha.dto';
import { UpdateTipoCanchaDto } from './dto/update-tipo-cancha.dto';
import { CambiarEstadoTipoCanchaDto } from './dto/cambiar-estado-tipo-cancha.dto';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('TiposCancha')
@ApiCookieAuth('token')
@Controller('tipos-cancha')
export class TiposCanchaController {
  constructor(private readonly tiposService: TiposCanchaService) {}

  // Público, sin guard: lo consumen la landing y el selector de alta.
  // Va ANTES que ':id' para que Nest no lo confunda con un parámetro.
  @Get()
  @ApiOperation({ summary: 'Catálogo público de tipos de cancha activos' })
  findPublicos() {
    return this.tiposService.findPublicos();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Get('todos')
  @ApiOperation({ summary: 'Listar todos los tipos (incluidos inactivos)' })
  findTodos() {
    return this.tiposService.findTodos();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Post()
  @ApiOperation({ summary: 'Crear un tipo de cancha con foto' })
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  create(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: CreateTipoCanchaDto,
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
    return this.tiposService.create(dto, foto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Cambiar nombre y/o foto de un tipo de cancha' })
  @ApiParam({ name: 'id', description: 'UUID del tipo de cancha' })
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: UpdateTipoCanchaDto,
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
    return this.tiposService.update(id, dto, foto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Activar o desactivar un tipo de cancha' })
  @ApiParam({ name: 'id', description: 'UUID del tipo de cancha' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoTipoCanchaDto,
  ) {
    return this.tiposService.cambiarEstado(id, dto.activo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TipoActor.GERENTE)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un tipo de cancha sin canchas asociadas' })
  @ApiParam({ name: 'id', description: 'UUID del tipo de cancha' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.tiposService.eliminar(id);
  }
}
