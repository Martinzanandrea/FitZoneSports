import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sede } from '../entities';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sede])],
  controllers: [SedesController],
  providers: [SedesService],
  exports: [SedesService], // otros módulos (usuarios, canchas, clases) van a necesitar validar que una sede existe
})
export class SedesModule {}
