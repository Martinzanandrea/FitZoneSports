# RNF-01 — El control de acceso funciona sin conexión

**Requisito (ADR-003):** el control de acceso funciona aunque se caiga la conexión principal a internet (disponibilidad de 99,5 %).

**Estado de la evidencia:** parte automatizada existente; **la prueba manual de punta a punta NO se corrió todavía**. Las casillas de este documento están vacías a propósito: se marcan solo cuando alguien ejecuta la prueba y registra el resultado.

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

*Completar en cada ejecución. Dejar sin marcar lo que no se ejecutó.*

| Dato | Valor |
|---|---|
| Fecha y hora | |
| Quién ejecutó | |
| Commit probado | |
| Navegador y versión | |
| Sistema operativo | |

| Paso | Resultado esperado | Pasó | Falló | No se ejecutó | Observaciones |
|---|---|---|---|---|---|
| 1 | Snapshot descargado, pantalla lista | ☐ | ☐ | ☐ | |
| 3 | Aviso *Modo sin conexión* visible | ☐ | ☐ | ☐ | |
| 4 | Ingreso aceptado con insignia *Sin conexión*; pendientes = 1 | ☐ | ☐ | ☐ | |
| 5 | Segundo ingreso del mismo socio rechazado | ☐ | ☐ | ☐ | |
| 6 | Código, DNI y egreso deshabilitados | ☐ | ☐ | ☐ | |
| 7 | Sincronización: pendientes = 0, evento creado | ☐ | ☐ | ☐ | |
| 8 | Fila `CREADO`/`OK` y `validado_offline = true` en la base | ☐ | ☐ | ☐ | |

**Resultado global:** ☐ Aprobada  ☐ Fallida  ☐ Aprobada con observaciones

### Capturas

Guardarlas en `docs/rnf/capturas/RNF-01/` con el nombre `AAAA-MM-DD-paso-N.png` y marcar las que se agregaron:

- ☐ Paso 3: aviso *Modo sin conexión*
- ☐ Paso 4: ingreso aceptado con la insignia *Sin conexión* y el contador de pendientes
- ☐ Paso 7: resumen de la última sincronización
- ☐ Paso 8: resultado de las consultas SQL

## 4. Qué no cubre

No mide la disponibilidad de 99,5 % del requisito: esa cifra exige monitoreo continuo de producción, que no existe en el repositorio. Esta prueba comprueba el comportamiento ante una caída de la conexión, no un porcentaje de disponibilidad.
