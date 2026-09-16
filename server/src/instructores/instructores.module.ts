import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instructor } from '../entities';
import { InstructoresService } from './instructores.service';
import { InstructoresController } from './instructores.controller';

//imports , aqui van las entidades de typeorm que se van a usar en este modulo, en este caso Instructor

@Module({
  imports: [TypeOrmModule.forFeature([Instructor])],
  controllers: [InstructoresController],
  providers: [InstructoresService],
  exports: [InstructoresService],
})
export class InstructoresModule {}
