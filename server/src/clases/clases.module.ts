import { Module } from '@nestjs/common';
import { ClasesService } from './clases.service';
import { ClasesController } from './clases.controller';

@Module({
  controllers: [ClasesController],
  providers: [ClasesService],
})
export class ClasesModule {}
