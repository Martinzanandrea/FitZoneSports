# ADR-023 — Almacenamiento de archivos intercambiable (Supabase Storage o disco local)

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

Las fotos de usuario, las imágenes de tipos de cancha y los comprobantes PDF se subían directamente con `SupabaseStorageService`, inyectado por clase concreta en tres servicios. Para cumplir `docker compose up --build` sin cuentas externas (ADR-009), la API tenía que poder guardar archivos sin Supabase; sin eso, pagar una reserva fallaba al generar el comprobante.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Clase abstracta `Almacenamiento` con dos implementaciones elegidas por configuración** | Los servicios no conocen al proveedor; mismo patrón que el correo (ADR-021) | Una abstracción más | Elegida |
| MinIO en el compose (S3 compatible) | Más parecido a un storage real | Otro contenedor y cambiar el cliente de Supabase por uno S3 | Más piezas para el mismo resultado |
| Pedir credenciales de Supabase para levantar el compose | Sin cambios de código | La cátedra no puede levantar el sistema sin cuentas del equipo | No cumple la condición de admisibilidad |

## Decisión

Los servicios dependen de la clase abstracta `Almacenamiento` (`server/src/storage/almacenamiento.ts`: subir, eliminar y leer). `StorageModule` elige la implementación con `STORAGE_PROVIDER`: `SupabaseStorageService` por defecto (producción) o `LocalStorageService` con `local`, que guarda en `STORAGE_LOCAL_DIR` y sirve los archivos en `/archivos`. La descarga de comprobantes también pasa por el contrato y solo lee de nuestro propio almacenamiento.

## Consecuencias

- **Positivas:** el sistema completo funciona en Docker sin Supabase; agregar otro proveedor es una clase nueva.
- **Negativas:** en modo local los archivos quedan en el volumen del contenedor, sin respaldo propio.
- **Deuda asumida:** las URLs públicas de comprobantes (en Supabase y en local) no exigen sesión: la descarga controlada es `GET /comprobantes/:id/archivo`.

## Requisitos relacionados

RF-14, RNF-04
