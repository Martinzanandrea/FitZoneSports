import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { MembresiasService } from './membresias.service';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';

@Controller('membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

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

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembresiaDto,
  ) {
    return this.membresiasService.update(id, dto);
  }

  @Post('marcar-vencidas')
  async marcarVencidas() {
    const cantidad = await this.membresiasService.marcarVencidasSiCorresponde();
    return { message: `${cantidad} membresía(s) marcadas como vencidas` };
  }
}
