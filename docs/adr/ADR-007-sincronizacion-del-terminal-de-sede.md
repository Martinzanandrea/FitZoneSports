# ADR-007 — Sincronización del terminal de sede con el servidor central

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

Si el terminal de sede valida ingresos sin conexión (ADR-003), necesita una copia local de los datos para decidir y una forma de devolver al servidor lo que pasó durante la caída. Hay que definir qué se replica, cada cuánto y qué hacer cuando lo registrado offline choca con el estado central (por ejemplo, el mismo socio ingresó en otra sede mientras esta estaba desconectada: RN-01).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Réplica mínima por sede + cola de ingresos con resolución en el servidor** | Datos chicos (id, nombre, apellido y fechas de membresía); el servidor decide los conflictos con toda la información | Ventana de datos desactualizados igual al intervalo de refresco | Alternativa elegida |
| Réplica completa de la base en cada sede | El terminal sabe todo | Volumen innecesario y datos personales replicados en 25 sedes | Desproporcionado y riesgoso |
| Base local con replicación bidireccional (CouchDB/PouchDB) | Sincronización resuelta por la herramienta | Otra base y otro modelo de datos solo para el terminal | Agrega una pieza de infraestructura para un caso acotado |

## Decisión

**Qué se replica.** El snapshot de la sede (`GET /acceso/snapshot/:sedeId`): la clave pública de firma del QR, el aforo, los identificadores de quienes están dentro y, por cada socio con membresía vigente o próxima de toda la red, `id`, nombre, apellido y las fechas `desde` y `hasta`. No incluye DNI, correo, teléfono ni foto. El snapshot vale 24 horas desde que lo genera el servidor.

**Frecuencia.** El terminal lo descarga al abrir la pantalla si no tiene uno guardado o si el guardado tiene más de 1 hora, y vuelve a revisar cada 5 minutos si hace falta renovarlo. La renovación solo ocurre con conexión.

**Cola.** Cada ingreso offline se guarda en IndexedDB con un `clientEventId` generado en el terminal (idempotencia) y la hora local de ocurrencia. Con conexión, y mientras haya pendientes, el terminal sincroniza al volver la red y cada 30 segundos. Envía `POST /acceso/sincronizar` en lotes de hasta 100 eventos de una misma sede.

**Resolución en el servidor.** Cada evento se procesa en su propia transacción y el resultado por evento puede ser:

- `CREADO`: el ingreso se registra con `validado_offline = true`.
- `OBSERVADO`: el ingreso se registra igual porque ya ocurrió, con una observación (`MEMBRESIA_NO_VIGENTE` o `AFORO_EXCEDIDO` al sincronizar).
- `CONFLICTO`: no se registra el ingreso. Ocurre con `SESION_ABIERTA` (el socio ya tenía un ingreso abierto, RN-01) o `QR_REUSADO` (el `jti` del QR ya estaba registrado). El evento queda guardado en `eventos_acceso_offline` con `acceso_id` nulo. No se notifica a la gerencia.
- `RECHAZADO`: el evento no es válido (`TOKEN_INVALIDO`, `QR_VENCIDO`, `FECHA_INVALIDA` por más de 72 horas de antigüedad, `USUARIO_INEXISTENTE`).

Un reintento con el mismo `clientEventId` no duplica: el servidor devuelve el resultado ya guardado (`YA_PROCESADO`). El terminal conserva en pantalla un resumen de la última sincronización con el detalle de los eventos que no salieron `CREADO`.

## Consecuencias

- **Positivas:** RN-01 queda registrada en `eventos_acceso_offline` aunque no se pueda impedir durante la caída; el servidor sigue siendo la fuente de verdad; los reintentos son seguros.
- **Negativas:** un socio dado de baja durante la caída puede ingresar hasta que venza o se renueve el snapshot (ventana de hasta 24 horas); hay que guardar datos personales mínimos en el dispositivo; un `CONFLICTO` por `SESION_ABIERTA` no registra el ingreso, de modo que la persona que entró físicamente no figura dentro hasta que alguien lo resuelva a mano.
- **Deuda asumida:** no hay notificación a la gerencia ante un conflicto y no hay un procedimiento automático para resolverlo; hoy se revisa el resumen de sincronización del terminal y la tabla `eventos_acceso_offline`.

## Límites conocidos

- Para recargar la página sin conexión hace falta la PWA con su service worker instalado.
- Los registros de `jti` usados y de códigos cortos están en memoria del servidor: no sobreviven a un reinicio ni se comparten entre instancias. Durante la sincronización, el uso único del QR lo garantiza el índice único `uq_evento_offline_jti`.
- La ventana de revocación llega a 24 horas, por la vigencia del snapshot.
- Un timeout puede dejar al servidor con el ingreso registrado y al terminal sin la respuesta; el terminal valida localmente y encola el ingreso, y al sincronizar termina en un conflicto `SESION_ABIERTA`.
- La lista de ingresos offline que muestra la pantalla vive solo en el estado de la pantalla y se pierde al recargar; la cola de IndexedDB y el contador de pendientes se conservan.
- Sin conexión, el aforo muestra "No se pudo cargar el aforo".
- Los eventos que el servidor rechaza con error 400 por formato inválido no se reintentan solos: quedan guardados en el dispositivo y no cuentan como pendientes.

## Requisitos relacionados

RNF-01, RN-01, RF-04
