import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async subirArchivo(
    bucket: string,
    buffer: Buffer,
    extension: string,
    contentType: string,
  ): Promise<string> {
    const nombreArchivo = `${randomUUID()}.${extension}`;

    const { error } = await this.client.storage
      .from(bucket)
      .upload(nombreArchivo, buffer, { contentType });

    if (error) {
      throw new Error(`Error subiendo archivo a ${bucket}: ${error.message}`);
    }

    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(nombreArchivo);
    return data.publicUrl;
  }

  // Borra un archivo propio a partir de su URL pública. Devuelve false si la URL
  // no es de este bucket o si falla (el llamador decide si le importa).
  async eliminarArchivo(bucket: string, urlPublica: string): Promise<boolean> {
    const marca = `/${bucket}/`;
    const i = urlPublica.indexOf(marca);
    if (i < 0) return false;
    const nombre = decodeURIComponent(
      urlPublica.slice(i + marca.length).split('?')[0],
    );
    const { error } = await this.client.storage.from(bucket).remove([nombre]);
    return !error;
  }
}
