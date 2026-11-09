import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../app.module';
import { crearDocumentoSwagger } from '../swagger';

// Exporta el contrato OpenAPI a server/swagger.json sin levantar la API ni
// conectarse a la base: el modo preview arma el grafo de módulos y
// controladores sin instanciar los providers.
//   npm run swagger:exportar
async function exportar() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const documento = crearDocumentoSwagger(app);
  const destino = join(__dirname, '..', '..', 'swagger.json');
  writeFileSync(destino, JSON.stringify(documento, null, 2) + '\n');
  const rutas = Object.keys(documento.paths).length;
  console.log(`swagger.json exportado (${rutas} rutas): ${destino}`);
  await app.close();
}

void exportar();
