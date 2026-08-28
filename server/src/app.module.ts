import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { SedesModule } from './sedes/sedes.module';
import { InstructoresModule } from './instructores/instructores.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MembresiasModule } from './membresias/membresias.module';
import { ClasesModule } from './clases/clases.module';
import { CanchasModule } from './canchas/canchas.module';
import { PagosModule } from './pagos/pagos.module';
import { AuthModule } from './auth/auth.module';
import { AccesoModule } from './acceso/acceso.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { PreciosModule } from './precios/precios.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    EventEmitterModule.forRoot(),
    SedesModule,
    InstructoresModule,
    ScheduleModule.forRoot(),
    UsuariosModule,
    MembresiasModule,
    ClasesModule,
    CanchasModule,
    PagosModule,
    AuthModule,
    AccesoModule,
    AdminModule,
    PreciosModule,

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // tiempo en segundos para el límite de solicitudes
          limit: 200, // número máximo de solicitudes permitidas en el período de tiempo
        },
      ],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,

      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
