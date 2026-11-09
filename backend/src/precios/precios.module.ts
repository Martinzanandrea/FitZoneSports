import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrecioPlan } from '../entities';
import { PreciosService } from './precios.service';
import { PreciosController } from './precios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrecioPlan])],
  controllers: [PreciosController],
  providers: [PreciosService],
  exports: [PreciosService],
})
export class PreciosModule {}
