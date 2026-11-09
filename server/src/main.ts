import { NestFactory } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { crearDocumentoSwagger } from './swagger';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { static as servirEstaticos } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  RUTA_ARCHIVOS_LOCALES,
  directorioArchivosLocales,
} from './storage/local-storage.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());

  // Con STORAGE_PROVIDER=local (docker compose) los archivos subidos se
  // sirven desde el disco, igual que las URLs públicas de Supabase Storage.
  // El portal (otro origen) muestra esas fotos, así que en ese modo se permite
  // la carga cross-origin; en producción helmet queda con su política por defecto.
  const config = app.get(ConfigService);
  const almacenamientoLocal = config.get<string>('STORAGE_PROVIDER') === 'local';
  app.use(
    helmet(
      almacenamientoLocal
        ? { crossOriginResourcePolicy: { policy: 'cross-origin' } }
        : undefined,
    ),
  );
  if (almacenamientoLocal) {
    app.use(
      RUTA_ARCHIVOS_LOCALES,
      servirEstaticos(directorioArchivosLocales(config), { index: false }),
    );
  }
  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Swagger UI en /api, fuera de producción. El mismo documento se exporta a
  // swagger.json con npm run swagger:exportar.
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api', app, crearDocumentoSwagger(app));
  }
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
