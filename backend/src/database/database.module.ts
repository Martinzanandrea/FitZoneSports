import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ALL_ENTITIES } from '../entities';
import { leerPoolConfig, opcionesDePool } from './pool.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: ALL_ENTITIES,
        synchronize: false, // nunca poner en true,la db ya la creamos.
        logging: false,
        ssl: { rejectUnauthorized: false },
        // Pool explícito (ver pool.config.ts y el README del servidor).
        ...opcionesDePool(leerPoolConfig((k) => config.get<string>(k))),
      }),
    }),
  ],
})
export class DatabaseModule {}
