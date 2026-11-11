# RNF-01 — El control de acceso funciona sin conexión

**Requisito (ADR-003):** el control de acceso funciona aunque se caiga la conexión principal a internet (disponibilidad de 99,5 %).

**Estado de la evidencia:** parte automatizada existente y **una ejecución manual en producción el 11/11/2026** (sección 3), que cubre el camino feliz: ingreso sin conexión, rechazo por socio ya dentro, cola y sincronización. **No se probaron** socio vencido, QR alterado ni QR de otra sede, y no se verificó la base de datos (paso 8). Las casillas se marcan solo con lo que se ejecutó y consta en las capturas.

## 1. Evidencia automatizada que ya existe

| Qué se prueba | Archivo |
|---|---|
| Clave ES256, snapshot y firma del QR | `backend/src/acceso/acceso-offline.spec.ts` |
| Conciliación de ingresos offline en el servidor | `backend/src/acceso/acceso-sincronizacion.spec.ts` |
| Conciliación contra PostgreSQL real | `backend/test/integracion/acceso-sincronizacion.int-spec.ts` |
| Sesión única RN-01 contra PostgreSQL real | `backend/test/integracion/acceso-rn01.int-spec.ts` |
| Verificación local del QR en el navegador | `frontend/src/modules/acceso/offline/verificarQr.test.ts` |
| Cola de ingresos y almacén local | `frontend/src/modules/acceso/offline/colaIngresos.test.ts`, `almacenOffline.test.ts` |
| Snapshot y decisiones de pantalla | `frontend/src/modules/acceso/offline/snapshot.test.ts`, `decisionesPantalla.test.ts` |

Estas pruebas verifican las piezas por separado. El manual técnico (sección 6.5) declara que **no hay una prueba de punta a punta del flujo completo**; la tarjeta FT1-130 la tiene pendiente. Este documento define esa prueba.

## 2. Prueba manual reproducible

**Objetivo:** comprobar que, con el terminal de recepción abierto y sin red, un QR válido se acepta con la insignia *Sin conexión*, queda en la cola y se concilia en el servidor al reconectar.

### Precondiciones

- Sistema levantado con datos de prueba (`docker compose up --build`; portal en `http://localhost:8080`, API en `http://localhost:3000`). Con `QR_CLAVE_EFIMERA=true` o con `QR_PRIVATE_KEY` configurada: **sin clave ES256 el modo offline no está disponible** (manual técnico, sección 6.1).
- Navegador de escritorio (se recomienda Chrome o Edge) con dos ventanas: una con la sesión del recepcionista y otra con la del socio.
- Usuarios (README, sección 4; contraseña de prueba en el README): recepcionista `recepcion1@fitzone.test` (sede 1) y socio `socio1.1@fitzone.test` (sede 1, membresía vigente).
- Anotar antes de empezar: commit probado (`git rev-parse HEAD`), navegador y versión, fecha y hora.

### Pasos

1. Ingresar como recepcionista en `/admin/login` y abrir **Control de acceso**. Esperar a que el terminal descargue el snapshot de la sede (se descarga al abrir la pantalla si no hay uno guardado o si el guardado tiene más de 1 hora). **No recargar la página desde este punto**: sin el service worker no se puede recargar sin conexión.
2. En la otra ventana, ingresar como socio y obtener el QR desde el portal. Vale 60 segundos: copiarlo (modo **Pegado**) o dejarlo listo para leerlo con la cámara.
3. **Cortar la red del equipo del terminal**: apagar el Wi-Fi o desconectar el cable, o en las herramientas de desarrollo del navegador, pestaña Red, elegir *Sin conexión* (*Offline*) para la ventana del recepcionista. Verificar que aparece el aviso *Modo sin conexión*.
4. Validar el QR con **Cámara** o **Pegado**. Resultado esperado: ingreso aceptado con la insignia **Sin conexión**, y el contador de pendientes en 1.
5. Intentar validar el **mismo** QR u otro QR del mismo socio. Resultado esperado: rechazado (el snapshot local ya registra al socio dentro).
6. Comprobar que los modos **Código** y **DNI** y el registro de egresos están deshabilitados con una leyenda (comportamiento declarado en el manual de usuario, sección 4.1).
7. **Restablecer la red**. Esperar la sincronización automática (hasta 30 segundos) o pulsar **Sincronizar ahora**. Resultado esperado: el contador de pendientes vuelve a 0 y el resumen de la última sincronización muestra el ingreso como creado.
8. Verificar en el servidor que el ingreso quedó registrado como offline (ejecutar contra la base de la prueba):

   ```sql
   SELECT estado, codigo, recibido_en FROM eventos_acceso_offline ORDER BY recibido_en DESC LIMIT 5;
   SELECT validado_offline, sincronizado_en, metodo_ingreso FROM control_acceso ORDER BY hora_ingreso DESC LIMIT 5;
   ```

   Resultado esperado: un evento `CREADO` / `OK` y un ingreso con `validado_offline = true`, `metodo_ingreso = 'QR_OFFLINE'` y `sincronizado_en` con fecha.

### Variantes opcionales

- **Conflicto:** repetir el paso 4 con un socio que ya tenga un ingreso abierto en el servidor; al sincronizar debe aparecer `CONFLICTO` / `SESION_ABIERTA`.
- **QR vencido:** validar sin conexión un QR de más de 60 segundos; debe ser rechazado.

## 3. Registro del resultado

### Ejecución del 11/11/2026

| Dato | Valor |
|---|---|
| Fecha y hora | 11/11/2026, entre las 3:01 y las 3:04 p. m. según el reloj del teléfono en las capturas |
| Entorno | Producción (la aplicación desplegada, no el entorno local con Docker de las precondiciones) |
| Dispositivo | Teléfono (captura de 1206 x 2622 px); el terminal de recepción se usó desde el teléfono |
| Sede | FitZone Central (aforo máximo 30, según la captura) |
| Quién ejecutó | Sin registrar |
| Commit probado | Sin registrar |
| Navegador, versión y sistema operativo | Sin registrar |

Pasos ejecutados (según las capturas, en este orden):

1. Terminal de recepción abierto con la red cortada: aviso *Sin conexión a internet*, *Modo sin conexión* con «Datos descargados vigentes» y «No hay ingresos pendientes de sincronizar» (3:01). El modo **Código** muestra «El ingreso por código requiere conexión a internet».
2. Validación de un QR con **Cámara** sin conexión: «Ingreso permitido: Martin Zanandrea» con la insignia *Sin conexión*; el socio figura en *Quién está dentro* como «pendiente de sincronizar» (3:02).
3. Conexión restablecida: «1 ingreso pendiente de sincronizar» con el botón en *Sincronizando...* (3:02).
4. Resultado de la sincronización: «Creados: 1. Observados: 0. Conflictos: 0. Rechazados: 0.» (3:02).
5. Con la red cortada de nuevo (3:04), nuevo intento de ingreso de la misma persona: «El socio ya figura dentro de una sede.» con la insignia *Sin conexión*. El aviso indica «No hay ingresos pendientes de sincronizar», es decir, el rechazo se produjo después de la sincronización, en un segundo período sin conexión.

| Paso | Resultado esperado | Pasó | Falló | No se ejecutó | Observaciones |
|---|---|---|---|---|---|
| 1 | Snapshot descargado, pantalla lista | ☑ | ☐ | ☐ | «Datos descargados vigentes» en la captura 19 |
| 3 | Aviso *Modo sin conexión* visible | ☑ | ☐ | ☐ | Capturas 19, 20 y 23 |
| 4 | Ingreso aceptado con insignia *Sin conexión*; pendientes = 1 | ☑ | ☐ | ☐ | Insignia y lista de pendientes visibles (captura 20); el aviso de «1 ingreso pendiente» aparece al reconectar (captura 21) |
| 5 | Segundo ingreso del mismo socio rechazado | ☑ | ☐ | ☐ | Captura 23; ocurrió después de la sincronización, no antes, como describe el paso 5 de la prueba |
| 6 | Código, DNI y egreso deshabilitados | ☐ | ☐ | ☑ | Solo se observó la leyenda del modo Código; DNI y egreso no se registraron |
| 7 | Sincronización: pendientes = 0, evento creado | ☑ | ☐ | ☐ | «Creados: 1. Observados: 0. Conflictos: 0. Rechazados: 0.» (captura 22) |
| 8 | Fila `CREADO`/`OK` y `validado_offline = true` en la base | ☐ | ☐ | ☑ | No se consultó la base de producción |

Variantes y casos no probados (sin marcar):

- ☐ Socio con membresía vencida o suspendida sin conexión
- ☐ QR alterado (firma inválida)
- ☐ QR de otra sede
- ☐ QR vencido (más de 60 segundos)
- ☐ Conflicto (`CONFLICTO` / `SESION_ABIERTA`) al sincronizar

**Resultado global:** ☐ Aprobada  ☐ Fallida  ☑ Aprobada con observaciones (camino feliz verificado; casos negativos, paso 6 completo y paso 8 sin ejecutar; faltan quién, commit y navegador).

### Capturas

Están en `docs/manuales/img/` (se reutilizan las del manual de usuario, sección 4.1 y 3.4):

- ☑ Paso 1 y 3: aviso *Modo sin conexión* — `19-recepcionista-sin-conexion.png`
- ☑ Paso 4: ingreso aceptado con la insignia *Sin conexión* — `20-recepcionista-scaneoQr-sin-conexion.png`
- ☑ Paso 5: rechazo por socio ya dentro — `23-recepcionista-ingreso-de-una-misma-persona-ya-dentro-rechazo-sin-conexion.png`
- ☑ Paso 7 (antes): 1 ingreso pendiente al reconectar — `21-recepcionista-pendiente-de-sincronizacionQR.png`
- ☑ Paso 7: resumen de la última sincronización — `22-recepcionista-sincronizacion-ingresoQr.png`
- ☐ Paso 8: resultado de las consultas SQL

Observación de interfaz: en las capturas 20 a 23 el visor negro de la cámara y la leyenda «QR detectado, validando...» permanecen en pantalla después de mostrar el resultado. Se corrigió en `ControlAcceso.tsx` (el lector se quita al terminar el escaneo); las capturas son anteriores a esa corrección.

## 4. Qué no cubre

No mide la disponibilidad de 99,5 % del requisito: esa cifra exige monitoreo continuo de producción, que no existe en el repositorio. Esta prueba comprueba el comportamiento ante una caída de la conexión, no un porcentaje de disponibilidad.
