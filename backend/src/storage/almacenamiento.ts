// Contrato del almacenamiento de archivos (fotos de usuario, imágenes de tipos
// de cancha y comprobantes PDF). Los servicios dependen de esta clase y no de
// un proveedor: StorageModule elige la implementación con STORAGE_PROVIDER.
//   supabase (por defecto)  Supabase Storage, el de producción
//   local                   disco del contenedor, para docker compose y pruebas
export abstract class Almacenamiento {
  // Sube el archivo y devuelve su URL pública.
  abstract subirArchivo(
    bucket: string,
    buffer: Buffer,
    extension: string,
    contentType: string,
  ): Promise<string>;

  // Borra un archivo a partir de su URL pública. Devuelve false si la URL no
  // es de este almacenamiento o si falla.
  abstract eliminarArchivo(bucket: string, urlPublica: string): Promise<boolean>;

  // Lee un archivo propio a partir de su URL pública; null si la URL no es de
  // este almacenamiento o el archivo no existe.
  abstract leerArchivo(urlPublica: string): Promise<Buffer | null>;
}
