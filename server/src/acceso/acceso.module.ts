import { Module } from '@nestjs/common';
import { AccesoService } from './acceso.service';
import { AccesoController } from './acceso.controller';

@Module({
  controllers: [AccesoController],
  providers: [AccesoService],
})
export class AccesoModule {}
