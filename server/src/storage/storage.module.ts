import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Almacenamiento } from './almacenamiento';
import { SupabaseStorageService } from './supabase-storage.service';
import { LocalStorageService } from './local-storage.service';

// Elige el proveedor de archivos por configuración (STORAGE_PROVIDER):
// "local" para docker compose y pruebas, Supabase en cualquier otro caso.
@Module({
  providers: [
    {
      provide: Almacenamiento,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Almacenamiento => {
        const proveedor = config.get<string>('STORAGE_PROVIDER')?.trim();
        if (proveedor === 'local') {
          new Logger('Storage').log('Almacenamiento de archivos: disco local');
          return new LocalStorageService(config);
        }
        return new SupabaseStorageService(config);
      },
    },
  ],
  exports: [Almacenamiento],
})
export class StorageModule {}
