# ADR-003 — Estrategia offline del control de acceso

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

RNF-01 exige que el control de acceso funcione aunque se caiga la conexión principal a internet (disponibilidad de 99,5 %). El QR del socio es un JWT que rota cada 60 segundos (RF-04) y que originalmente se firmaba con el secreto del servidor (HS256) y se validaba solo con un `POST /acceso/validar` al servidor central. La tabla `control_acceso` tenía las columnas `validado_offline` y `sincronizado_en`, pero ningún código las usaba: sin conexión, la pantalla de recepción bloqueaba la validación. Para validar en la sede sin el servidor, el terminal necesitaba poder verificar la firma del QR y saber si la membresía está vigente, sin conocer el secreto de firma.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **QR firmado con clave asimétrica + copia local de socios vigentes** | El terminal verifica la firma con la clave pública, sin secreto; funciona sin red; RN-01 se re-verifica al sincronizar | Hay que distribuir la clave pública y una lista de vigencias a cada terminal; ventana de inconsistencia mientras dura la caída | Alternativa elegida |
| Mantener el QR con HS256 y copiar el secreto al terminal | Cambio mínimo en el servidor | Un terminal comprometido permitiría generar QR válidos para cualquiera | Riesgo de seguridad inaceptable |
| Validación manual con lista impresa o DNI | Sin desarrollo | No hay registro automático; RN-01 imposible de controlar | No cumple RNF-01 de forma verificable |
| Conexión de respaldo (4G) en cada sede | Sin cambios de software | Costo de infraestructura; no cubre la caída del servidor central | No resuelve la caída del backend |

## Decisión

Se firma el QR con **ES256** (curva P-256): la clave privada vive solo en el servidor (`ClavesQrService`, variable `QR_PRIVATE_KEY`) y la clave pública se publica como JWK en `GET /acceso/clave-publica`. El terminal de sede (la pantalla de recepción, una PWA, ver ADR-011) descarga el snapshot de su sede con `GET /acceso/snapshot/:sedeId` y guarda en IndexedDB la clave pública y la lista de socios con membresía vigente o próxima, con sus fechas de inicio y fin. El snapshot vale 24 horas desde que el servidor lo genera. Sin conexión, el terminal verifica la firma del QR con WebCrypto, su vencimiento (con tolerancia de reloj), la vigencia local de la membresía, la sesión abierta y el aforo, y registra el ingreso en una cola local con un `clientEventId`; al reconectar lo envía con `POST /acceso/sincronizar` (ver ADR-007). Los ingresos sincronizados quedan con `validado_offline = true`. El criterio determinante es que la validación offline no puede requerir ningún secreto en la sede.

Si el servidor no tiene `QR_PRIVATE_KEY` configurada, el QR se sigue firmando con HS256 y el modo offline no está disponible: `GET /acceso/clave-publica` y el snapshot responden 404.

## Consecuencias

- **Positivas:** el acceso sigue funcionando con el servidor central caído; la seguridad del QR no depende de los terminales; el terminal no guarda secretos.
- **Negativas:** durante la caída RN-01 no se puede garantizar entre sedes (cada terminal solo conoce el estado del snapshot y sus propios ingresos); se resuelve al sincronizar, con el conflicto registrado. El terminal guarda datos personales mínimos (identificador, nombre, apellido y fechas de membresía) de los socios de la red.
- **Deuda asumida:** hay que rehacer el snapshot si crece la red de sedes (hoy incluye a los socios vigentes de toda la red); no hay documentado un procedimiento de rotación de la clave ES256.

## Límites conocidos

- Para recargar la página sin conexión hace falta la PWA con su service worker instalado. Sin él, el navegador no puede abrir la aplicación y el terminal solo funciona si la pantalla de control de acceso ya estaba abierta cuando se cayó la conexión.
- Los registros de `jti` usados y de códigos cortos están en memoria del servidor: no sobreviven a un reinicio ni se comparten entre varias instancias de la API. El uso único del QR offline se garantiza en la sincronización con el índice único `uq_evento_offline_jti`.
- La ventana de revocación llega a 24 horas: un socio dado de baja o suspendido puede ingresar sin conexión hasta que venza el snapshot del terminal o se renueve con conexión.
- Si una respuesta del servidor se pierde por un timeout después de haber registrado el ingreso, el terminal valida localmente y encola el mismo ingreso; al sincronizar puede terminar en un conflicto `SESION_ABIERTA`.
- La lista de ingresos offline que muestra la pantalla vive solo en el estado de la pantalla: se pierde al recargar. Los ingresos siguen en la cola de IndexedDB y en el contador de pendientes.
- Sin conexión, el aforo muestra "No se pudo cargar el aforo". El terminal no calcula el aforo local que sí usa para validar.
- No hay una prueba de punta a punta del flujo completo (corte de red real, reconexión y sincronización contra el servidor); las pruebas cubren las funciones por separado.

## Requisitos relacionados

RNF-01, RF-04, RN-01
