import { Module } from '@nestjs/common';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';

@Module({
  controllers: [SedesController],
  providers: [SedesService],
})
export class SedesModule {}
