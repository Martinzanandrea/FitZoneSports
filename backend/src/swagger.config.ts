import { DocumentBuilder } from '@nestjs/swagger';

// Configuración única del contrato OpenAPI: la usan main.ts (Swagger UI en
// desarrollo) y scripts/export-swagger.ts (exportación a swagger.json).
export function crearConfigSwagger() {
  return new DocumentBuilder()
    .setTitle('FitZone Sports API')
    .setDescription('API del sistema de gestión de gimnasios')
    .setVersion('1.0')
    .addCookieAuth('token') // documenta que auth usa la cookie httpOnly
    .build();
}
