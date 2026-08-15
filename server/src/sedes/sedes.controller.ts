import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Post()
  create(@Body() dto: CreateSedeDto) {
    return this.sedesService.create(dto);
  }

  @Get()
  findAll() {
    return this.sedesService.findAll();
  }
  //ParseUUIDPipe valida que el id sea un UUID y tira 400 si no lo es. Si no se pone, TypeORM tira 500 al intentar buscar un id inválido.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSedeDto) {
    return this.sedesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sedesService.remove(id);
  }
}
