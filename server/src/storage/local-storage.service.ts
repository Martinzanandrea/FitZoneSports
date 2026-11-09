import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Almacenamiento } from './almacenamiento';

// Prefijo de las URLs públicas. main.ts sirve esta ruta como estática.
export const RUTA_ARCHIVOS_LOCALES = '/archivos';

// Directorio donde se guardan los archivos (volumen en docker compose).
export function directorioArchivosLocales(config: ConfigService): string {
  return path.resolve(config.get<string>('STORAGE_LOCAL_DIR') ?? 'archivos');
}

// Almacenamiento en disco para entornos sin Supabase (docker compose,
// pruebas). Misma interfaz que Supabase Storage: devuelve URLs públicas
// http://<api>/archivos/<bucket>/<archivo>.
@Injectable()
export class LocalStorageService extends Almacenamiento {
  private readonly directorio: string;
  private readonly urlBase: string;

  constructor(config: ConfigService) {
    super();
    this.directorio = directorioArchivosLocales(config);
    const api = (
      config.get<string>('PUBLIC_API_URL') ??
      `http://localhost:${config.get<string>('PORT') ?? 3000}`
    ).replace(/\/$/, '');
    this.urlBase = `${api}${RUTA_ARCHIVOS_LOCALES}`;
  }

  async subirArchivo(
    bucket: string,
    buffer: Buffer,
    extension: string,
  ): Promise<string> {
    const nombre = `${randomUUID()}.${extension}`;
    const carpeta = path.join(this.directorio, this.limpiar(bucket));
    await fs.mkdir(carpeta, { recursive: true });
    await fs.writeFile(path.join(carpeta, nombre), buffer);
    return `${this.urlBase}/${this.limpiar(bucket)}/${nombre}`;
  }

  async eliminarArchivo(_bucket: string, urlPublica: string): Promise<boolean> {
    const ruta = this.rutaDesdeUrl(urlPublica);
    if (!ruta) return false;
    try {
      await fs.unlink(ruta);
      return true;
    } catch {
      return false;
    }
  }

  async leerArchivo(urlPublica: string): Promise<Buffer | null> {
    const ruta = this.rutaDesdeUrl(urlPublica);
    if (!ruta) return null;
    try {
      return await fs.readFile(ruta);
    } catch {
      return null;
    }
  }

  // Solo URLs propias, y sin salir del directorio (nada de "../").
  private rutaDesdeUrl(urlPublica: string): string | null {
    if (!urlPublica.startsWith(`${this.urlBase}/`)) return null;
    const relativa = decodeURIComponent(
      urlPublica.slice(this.urlBase.length + 1).split('?')[0],
    );
    const ruta = path.resolve(this.directorio, relativa);
    return ruta.startsWith(this.directorio + path.sep) ? ruta : null;
  }

  private limpiar(bucket: string): string {
    return bucket.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}
