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
}
