import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { crearConfigSwagger } from '../src/swagger.config';

// Genera backend/swagger.json. Con preview:true Nest arma el grafo de módulos
// y lee los decoradores sin instanciar providers, así que no abre conexión a
// la base de datos ni necesita credenciales reales.
async function exportar() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const documento = SwaggerModule.createDocument(app, crearConfigSwagger());
  const destino = join(__dirname, '..', 'swagger.json');
  writeFileSync(destino, JSON.stringify(documento, null, 2) + '\n', 'utf8');
  console.log(`Contrato OpenAPI escrito en ${destino}`);
  await app.close();
}

exportar().catch((err) => {
  console.error(err);
  process.exit(1);
});
