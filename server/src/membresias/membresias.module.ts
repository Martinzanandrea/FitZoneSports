import { Module } from '@nestjs/common';
import { MembresiasService } from './membresias.service';
import { MembresiasController } from './membresias.controller';

@Module({
  controllers: [MembresiasController],
  providers: [MembresiasService],
})
export class MembresiasModule {}
