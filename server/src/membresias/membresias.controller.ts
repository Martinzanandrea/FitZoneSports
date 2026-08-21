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
import { MembresiasService } from './membresias.service';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Post()
  create(@Body() dto: CreateMembresiaDto) {
    return this.membresiasService.create(dto);
  }

  @Get()
  findAll() {
    return this.membresiasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.membresiasService.findOne(id);
  }

  @Roles(TipoActor.RECEPCIONISTA, TipoActor.GERENTE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembresiaDto,
  ) {
    return this.membresiasService.update(id, dto);
  }

  @Roles(TipoActor.GERENTE)
  @Post('marcar-vencidas')
  async marcarVencidas() {
    const cantidad = await this.membresiasService.marcarVencidasSiCorresponde();
    return { message: `${cantidad} membresía(s) marcadas como vencidas` };
  }
}
