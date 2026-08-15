import { Module } from '@nestjs/common';
import { InstructoresService } from './instructores.service';
import { InstructoresController } from './instructores.controller';

@Module({
  controllers: [InstructoresController],
  providers: [InstructoresService],
})
export class InstructoresModule {}
