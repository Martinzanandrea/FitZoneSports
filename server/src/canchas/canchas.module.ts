import { Module } from '@nestjs/common';
import { CanchasService } from './canchas.service';
import { CanchasController } from './canchas.controller';

@Module({
  controllers: [CanchasController],
  providers: [CanchasService],
})
export class CanchasModule {}
