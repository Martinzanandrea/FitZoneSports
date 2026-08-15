import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { SedesModule } from './sedes/sedes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MembresiasModule } from './membresias/membresias.module';
import { AccesoModule } from './acceso/acceso.module';
import { InstructoresModule } from './instructores/instructores.module';
import { ClasesModule } from './clases/clases.module';
import { CanchasModule } from './canchas/canchas.module';
import { PagosModule } from './pagos/pagos.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    SedesModule,
    UsuariosModule,
    MembresiasModule,
    AccesoModule,
    InstructoresModule,
    ClasesModule,
    CanchasModule,
    PagosModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
