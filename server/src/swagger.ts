import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

// Contrato OpenAPI de la API. Lo usan main.ts (Swagger UI en /api, fuera de
// producción) y scripts/exportar-swagger.ts (genera swagger.json).
export function crearDocumentoSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('FitZone Sports API')
    .setDescription('API del sistema de gestión de gimnasios')
    .setVersion('1.0')
    .addCookieAuth('token') // documenta que auth usa la cookie httpOnly
    .build();
  return SwaggerModule.createDocument(app, config);
}
