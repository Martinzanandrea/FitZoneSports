# Manual técnico — FitZone Sports

**Versión:** 1.0 · **Fecha:** 2026-11-09 · **Aplica a:** tag `v1.0-entrega`

Dirigido a un desarrollador que se suma al proyecto o que tiene que extenderlo. Supone conocimientos de TypeScript, NestJS, React y SQL.

---

## 1. Visión arquitectónica · Diagramas C4 · Índice de ADR

FitZone Sports es un **monolito modular** (ADR-001): una sola API NestJS, organizada en módulos por dominio, sobre una única base PostgreSQL (ADR-002), con un cliente React que funciona como portal del socio y consola de administración (ADR-006), distribuido como PWA (ADR-011).

```
frontend/  React 19 + Vite + Tailwind 4 (PWA)  ──HTTPS /api, cookie JWT──►  backend/  NestJS 11 + TypeORM  ──SQL──►  PostgreSQL 17
                                                                               │
                                                     Pasarela mock · Brevo/Gmail · Web Push · Supabase Storage / disco
```

| Diagrama | Archivo |
|---|---|
| C4-1 Contexto | [`docs/diagramas/c4-1-contexto.svg`](../diagramas/c4-1-contexto.svg) |
| C4-2 Contenedores | [`docs/diagramas/c4-2-contenedores.svg`](../diagramas/c4-2-contenedores.svg) |
| C4-3 Componentes de Canchas | [`docs/diagramas/c4-3-componentes-canchas.svg`](../diagramas/c4-3-componentes-canchas.svg) |
| C4-3 Componentes de Acceso | [`docs/diagramas/c4-3-componentes-acceso.svg`](../diagramas/c4-3-componentes-acceso.svg) |
| DER físico | [`docs/diagramas/der-fisico.svg`](../diagramas/der-fisico.svg) |
| Despliegue | [`docs/diagramas/despliegue.svg`](../diagramas/despliegue.svg) |
| Pipeline | [`docs/diagramas/pipeline.svg`](../diagramas/pipeline.svg) |

Las fuentes editables (`.mmd`) están junto a cada exportación. El índice completo de decisiones está en [`docs/adr/README.md`](../adr/README.md): ADR-001 a ADR-010 son los obligatorios; ADR-011 a ADR-023, los propios del desarrollo.

### Estructura del repositorio

```
backend/
  src/<módulo>/         controlador, servicio, DTOs, pruebas unitarias (*.spec.ts)
  src/entities/         entidades TypeORM (mapeo del esquema)
  src/common/           helpers, DTOs y abstracciones compartidas (paginación, mail, errores de base)
  db/sql/               migraciones NNN-*.sql y reversion/NNN-*.down.sql
  db/seed/              datos de prueba
  db/migrar.js          script de migraciones
  test/integracion/     pruebas contra Postgres real
  scripts/              exportación de swagger.json
  swagger.json          contrato OpenAPI exportado
frontend/
  src/modules/<módulo>/ páginas, componentes y capa de servicio (*.api.ts) por dominio
  src/shared/components átomos, moléculas y organismos (Atomic Design)
  src/api/axios.ts      instancia única de HTTP
docs/                   adr, diagramas, manuales, bitácoras, planificación, rnf
```

## 2. Los cinco módulos funcionales y sus responsabilidades

| Módulo del enunciado | Carpetas del backend | Responsabilidad | Requisitos |
|---|---|---|---|
| **M1 Usuarios y membresías** | `usuarios/`, `auth/`, `membresias/`, `clientes/`, `precios/` | Registro y verificación de email, login con JWT en cookie, roles y alcance por sede, planes y vigencia por fechas | RF-01, RF-02, RF-03, RN-03 |
| **M2 Gimnasio y acceso** | `acceso/` | QR rotativo, código de 6 dígitos, ingreso por DNI, egreso, aforo y RN-01 | RF-04, RF-05, RN-01, RNF-01 |
| **M3 Clases grupales** | `clases/`, `instructores/` | Plantillas semanales, generación de ocurrencias, reservas con cupo, lista de espera | RF-06, RF-07, RF-08 |
| **M4 Canchas** | `canchas/` | Canchas por sede, tipos, turnos, mantenimiento y bloqueos, precio dinámico, reserva sin sobreventa | RF-09 a RF-12, RN-02 |
| **M5 Pagos y facturación** | `pagos/` | Pasarela simulada, cobro en efectivo, comprobantes PDF, historial | RF-13, RF-14, RNF-02 |

Módulos de soporte: `sedes/` (sedes y franjas horarias, RNF-04), `notificaciones/` (panel, email y push), `auditoria/`, `admin/` (reportes consolidados), `storage/` (archivos), `database/` (conexión y pool).

**Reglas de dependencia.** Un módulo usa a otro solo a través de los servicios que ese módulo exporta en su `*.module.ts` (por ejemplo, `CanchasModule` importa `MembresiasModule` para saber si el socio está al día). Las reacciones entre módulos que no deben acoplarse se resuelven con eventos (`@nestjs/event-emitter`), como la lista de espera.

**Autorización.** Cada endpoint declara los roles con `@Roles(...)` y pasa por `JwtAuthGuard` y `RolesGuard`. El alcance por sede se aplica en el servicio con `assertSedeScope` (fail-closed: un recepcionista sin sede no ve nada). Ver ADR-014 y ADR-020.

## 3. Modelo de datos y convenciones de persistencia

El esquema completo está en el [DER físico](../diagramas/der-fisico.svg), generado desde la base que crean las migraciones.

**Convenciones** (ADR-013):

- Claves primarias UUID (`gen_random_uuid()`).
- Nombres en español y `snake_case` en la base; `camelCase` en las entidades (`@Column({ name: 'fecha_inicio' })`).
- Montos en `NUMERIC(10,2)`; TypeORM los entrega como `string` y se convierten con `Number()` al calcular.
- Vocabularios cerrados como `ENUM` de Postgres, reflejados en `backend/src/entities/enums.ts` y `frontend/src/shared/types/enums.ts`.
- Fechas de negocio como `date` y horas como `time` en **hora de Argentina** (helpers en `common/helpers/hora-argentina.helper.ts`); instantes como `timestamptz`.
- Baja lógica (`activo`, `activa`) salvo excepciones documentadas.
- `synchronize: false`: el esquema lo definen **solo** las migraciones SQL. Una entidad nueva necesita su migración.

**Restricciones que sostienen reglas de negocio:**

| Restricción | Regla |
|---|---|
| `uq_cancha_horario_confirmado` en `reservas_cancha (cancha_id, fecha, hora_inicio) WHERE estado='CONFIRMADA'` | RN-02 |
| `uq_acceso_abierto_por_usuario` en `control_acceso (usuario_id) WHERE hora_egreso IS NULL` | RN-01 |
| `excl_membresia_sin_superposicion` (EXCLUDE GiST sobre `daterange`) | Una sola membresía por período |
| `uq_reserva_usuario_ocurrencia` | Un socio no reserva dos veces la misma clase |
| CHECK exclusive arc en `pagos` | Un pago es de exactamente una cosa; efectivo sin token y online sin cajero |
| `idx_reservas_cancha_disponibilidad` | Consulta de grilla en milisegundos (RNF-03) |

Los errores de Postgres se traducen a HTTP en `common/helpers/db-errors.helper.ts`: `23505` (único) y `23P01` (exclusión) pasan a **409 Conflict** con un mensaje que nunca incluye el valor duplicado.

## 4. Patrones de diseño aplicados y su ubicación en el código

### 4.1 Strategy — precio dinámico de canchas

| Rol | Clase | Archivo |
|---|---|---|
| Interfaz | `PricingStrategy` (`aplica(contexto)`, `calcular(precio)`) | `canchas/pricing/pricing-strategy.interface.ts` |
| Estrategias concretas | `MemberDiscountPricing` (−15 %), `PeakHourPricing` (+15 % de 19 a 21 h) | `canchas/pricing/*.strategy.ts` |
| Contexto | `PricingCalculatorService` | `canchas/pricing/pricing-calculator.service.ts` |
| Registro | proveedor `PRICING_STRATEGIES` con `useFactory` | `canchas/canchas.module.ts` |

El contexto recibe el arreglo de estrategias por inyección, aplica en orden las que dicen `aplica()` y devuelve el precio y la estrategia resultante (`ESTANDAR`, `SOCIO_DESCUENTO`, `HORA_PICO`, `SOCIO_HORA_PICO`), que queda guardada en la reserva. La **tarifa de externo** para el socio en mora (RN-03) sale de que `MemberDiscountPricing` no aplica cuando la membresía no está vigente; el estado lo decide el patrón **State** de `membresias/estado-membresia.ts`.

El mismo patrón se usa para los canales de notificación (`notificaciones/notificadores/`) y los proveedores de correo (`common/mail/`, ADR-021).

### 4.2 Observer — lista de espera de clases

| Rol | Elemento | Archivo |
|---|---|---|
| Evento | `CLASE_CUPO_LIBERADO` | `clases/events/clase.events.ts` |
| Publicador | `ReservasClaseService.cancelar()` emite con `EventEmitter2` | `clases/reserva-clase.service.ts` |
| Suscriptor | `ListaEsperaListener` (`@OnEvent`) | `clases/listeners/lista-espera.listener.ts` |

Al cancelar una reserva, el servicio emite el evento sin saber quién lo escucha. El listener toma la primera reserva en `LISTA_ESPERA` de esa ocurrencia (por orden de creación), la pasa a `RESERVADA` y notifica al socio por los canales configurados. Agregar otra reacción (por ejemplo, avisar al instructor) es agregar otro listener, sin tocar el servicio.

### 4.3 Repository — abstracción de la persistencia

| Interfaz | Implementaciones | Token |
|---|---|---|
| `IBookingCanchaRepository` | `TypeOrmBookingCanchaRepository`, `InMemoryBookingCanchaRepository` | `BOOKING_CANCHA_REPOSITORY` |
| `IBookingClaseRepository` | `TypeOrmBookingClaseRepository`, `InMemoryBookingClaseRepository` | `BOOKING_CLASE_REPOSITORY` |

Los servicios dependen de la interfaz; el módulo decide la implementación. La de TypeORM encapsula la transacción y el bloqueo (sección 5); la de memoria permite probar los servicios sin base. El resto del acceso a datos usa `Repository<T>` de TypeORM, que ya es un repositorio genérico.

### 4.4 Patrones creacionales y estructurales

| Patrón | Dónde | Para qué |
|---|---|---|
| **Factory** | `crearEnviadorCorreo()` (`common/mail/crear-enviador.ts`), `NotificadorFactory` (`notificaciones/notificadores/notificador.factory.ts`), `StorageModule` (`useFactory`) | Elegir la implementación por configuración o por canal |
| **Facade** | `ReservasCanchaService.reservar()` | Un punto de entrada que orquesta validaciones, precio y reserva |
| **Singleton** | Proveedores de Nest (alcance por defecto) | Una instancia por aplicación (por ejemplo, el registro de QR usados) |
| **Adapter** | `SupabaseStorageService` y `LocalStorageService` sobre `Almacenamiento`; `PasarelaMockService` sobre `PasarelaPago` | Adaptar servicios externos a un contrato propio |
| **Decorator** | `@Auditable()` + `AuditoriaInterceptor`; `@Roles()`, `@CurrentUser()` | Agregar comportamiento transversal sin tocar los controladores |
| **State** | `membresias/estado-membresia.ts` | Comportamiento según el estado de la membresía (QR, tarifa) |

## 5. Control de concurrencia en las reservas

Ver ADR-004. Flujo de `TypeOrmBookingCanchaRepository.crearReservaSegura()`:

1. Abre una transacción (o se une a la del llamador, como en el cobro presencial que guarda reserva, pago y comprobante juntos).
2. `SELECT ... FOR UPDATE` sobre **la fila de la cancha**: cualquier otra reserva de esa cancha espera a que esta transacción termine.
3. Con el lock tomado, verifica mantenimiento, bloqueos por franja y que no haya otra reserva `CONFIRMADA` en ese horario. Esa lectura es confiable porque nadie más puede estar insertando.
4. Inserta. Si igual hubiera un duplicado (un bug futuro, un acceso directo), el índice único parcial lo rechaza con `23505`.

El perdedor recibe **409** *Ese horario ya fue reservado para esta cancha*. Las clases usan el mismo esquema con el lock sobre la **ocurrencia**: el conteo del cupo ocurre bajo el lock y, si no hay lugar, la reserva entra en `LISTA_ESPERA`.

En el acceso (RN-01) no hay lock: dos validaciones simultáneas pueden pasar el chequeo, y el índice `uq_acceso_abierto_por_usuario` rechaza la segunda, que se traduce a 409.

**Evidencia:** `backend/test/integracion/` corre contra Postgres real. 10 reservas simultáneas de la misma cancha confirman exactamente una; 12 socios por 5 lugares dejan 5 reservadas y 7 en espera; dos ingresos simultáneos del mismo socio en sedes distintas registran uno.

## 6. Arquitectura offline del control de acceso

La decisión está en ADR-003 (estrategia) y ADR-007 (sincronización). El terminal de sede es la pantalla de **Control de acceso** del recepcionista (`ControlAcceso.tsx`), una PWA que valida el QR en el navegador cuando no hay conexión con la API.

### 6.1 Qué hace cada parte

| Parte | Dónde | Responsabilidad |
|---|---|---|
| Firma del QR | `AccesoService.generarQr()` y `ClavesQrService` (`backend/src/acceso/`) | QR de 60 segundos con `jti` único, firmado con **ES256** (clave P-256 en `QR_PRIVATE_KEY`, identificador `kid` en la cabecera). Sin clave configurada, firma con HS256 y el modo offline no está disponible |
| Clave pública | `GET /acceso/clave-publica` | Publica la clave como JWK. Responde 404 si no hay clave ES256 |
| Snapshot de la sede | `GET /acceso/snapshot/:sedeId` (`AccesoService.obtenerSnapshot()`) | Clave pública, aforo, quiénes están dentro y los socios con membresía vigente o próxima de la red (`id`, nombre, apellido, `desde`, `hasta`). Vale **24 horas** (`SNAPSHOT_TTL_MS`). Solo para recepcionista y gerente de sede, con alcance por sede |
| Verificación local | `frontend/src/modules/acceso/offline/verificarQr.ts` | Verifica la firma ES256 con WebCrypto y la clave del snapshot, el vencimiento (con tolerancia de reloj) y el tipo del token |
| Almacén local | `offline/almacenOffline.ts` | IndexedDB con tres almacenes: `snapshot`, `cola` y `meta`. Sin librerías |
| Snapshot y cola | `offline/snapshot.ts`, `offline/colaIngresos.ts` | Descarga y vigencia del snapshot; validación contra el snapshot local (membresía, sesión abierta, aforo) y alta del ingreso en la cola |
| Estado de la pantalla | `offline/useModoOffline.ts`, `offline/decisionesPantalla.ts` | Conexión, pendientes, vigencia del snapshot, sincronización automática, textos y reglas de la pantalla |
| Sesión sin red | `modules/auth/sesionLocal.ts`, `api/clasificarError.ts` | Copia local del usuario (sin tokens, vence a las 24 horas) para abrir la aplicación sin conexión; un error de red nunca cierra la sesión, un 401 o 403 sí |
| Conciliación | `POST /acceso/sincronizar` (`AccesoService.sincronizarIngresosOffline()`) | Procesa la cola. Solo para recepcionista. Tabla `eventos_acceso_offline` (migración 012) |

### 6.2 Flujo

1. **Preparación, con conexión.** Al abrir Control de acceso, la pantalla descarga la clave pública y el snapshot de la sede si no hay uno guardado o si el guardado tiene más de 1 hora, y revisa cada 5 minutos si hace falta renovarlo.
2. **Generación del QR.** El socio obtiene en su portal un QR ES256 de 60 segundos con `jti` único.
3. **Validación.** Con conexión se usa `POST /acceso/validar`. Sin conexión, o si la llamada falla por red, timeout o un error 5xx, la pantalla valida con los datos descargados. Un 4xx del servidor (por ejemplo, membresía vencida) se muestra como rechazo real y no pasa a validación local.
4. **Cola.** Cada ingreso aceptado sin conexión se guarda en IndexedDB con un `clientEventId` (UUID generado en el terminal), el QR leído y la hora de ocurrencia. El snapshot local se actualiza para que el mismo socio no pueda volver a ingresar y para que el aforo local suba. La pantalla muestra la insignia "Sin conexión" y el contador de pendientes.
5. **Sincronización.** Al volver la conexión, y cada 30 segundos mientras haya pendientes, el terminal envía la cola por `POST /acceso/sincronizar`, agrupada por sede en lotes de hasta 100 eventos. También se puede forzar con "Sincronizar ahora".
6. **Resultado.** El servidor verifica cada evento y devuelve un resultado por evento. El terminal borra de la cola los eventos respondidos y muestra el resumen de la última sincronización.

### 6.3 Conciliación en el servidor

Cada evento se procesa en su propia transacción. Se verifican, en orden: la idempotencia por `clientEventId`, la firma ES256, el algoritmo, el `kid` y el tipo del token, la ventana de validez del QR con tolerancia de reloj (2 minutos), la antigüedad (hasta 72 horas; una fecha futura se acota a la actual) y la existencia del usuario. Después se inserta primero el evento (el índice único `uq_evento_offline_jti` detecta un QR repetido) y luego el ingreso (el índice parcial `uq_acceso_abierto_por_usuario` detecta una sesión abierta).

| Estado | Código | Significado | ¿Se registra el ingreso? |
|---|---|---|---|
| `CREADO` | `OK` | Ingreso válido | Sí (`validado_offline = true`, método `QR_OFFLINE`) |
| `OBSERVADO` | `MEMBRESIA_NO_VIGENTE` | La membresía no estaba vigente o el usuario estaba inactivo al sincronizar | Sí, con observación |
| `OBSERVADO` | `AFORO_EXCEDIDO` | La sede superaba el aforo máximo al sincronizar | Sí, con observación |
| `CONFLICTO` | `SESION_ABIERTA` | El socio ya tenía un ingreso abierto (RN-01) | No |
| `CONFLICTO` | `QR_REUSADO` | El `jti` del QR ya estaba registrado | No |
| `RECHAZADO` | `TOKEN_INVALIDO` | Firma, algoritmo, `kid` o tipo inválidos | No |
| `RECHAZADO` | `QR_VENCIDO` | El ingreso ocurrió fuera de la vigencia del QR | No |
| `RECHAZADO` | `FECHA_INVALIDA` | El ingreso tiene más de 72 horas de antigüedad | No |
| `RECHAZADO` | `USUARIO_INEXISTENTE` | El usuario del QR no existe | No |
| (el estado guardado) | `YA_PROCESADO` | El `clientEventId` ya se había procesado; se devuelve lo guardado, sin duplicar | Según el resultado original |

Los fallos por evento viajan dentro de una respuesta 200 y el orden de la respuesta es el del pedido. Un lote con formato inválido recibe 400: el terminal no lo reintenta solo y esos eventos quedan guardados en el dispositivo sin contar como pendientes. El resultado de cada evento queda en `eventos_acceso_offline`, también el de los conflictos y rechazos.

### 6.4 Pruebas

`backend/src/acceso/acceso-offline.spec.ts` (clave, snapshot y firma), `acceso-sincronizacion.spec.ts` (conciliación) y `backend/test/integracion/acceso-sincronizacion.int-spec.ts` (contra PostgreSQL). En el frontend, un archivo `*.test.ts` junto a cada módulo de `offline/`, más `sesionLocal.test.ts` y `clasificarError.test.ts`.

### 6.5 Límites conocidos

Están detallados en ADR-003 y ADR-007. Los principales: sin el service worker de la PWA no se puede recargar la página sin conexión; los mapas de `jti` y de códigos cortos están en memoria del servidor (no sobreviven a un reinicio ni se comparten entre instancias; con más de una instancia habría que pasarlos a la base o a Redis); un socio dado de baja puede ingresar hasta 24 horas; un timeout puede terminar en un conflicto `SESION_ABIERTA`; la lista offline de la pantalla se pierde al recargar y el aforo muestra "No se pudo cargar el aforo" sin conexión. No hay una prueba de punta a punta del flujo completo.

## 7. Guía de extensión

### 7.1 Caso resuelto: agregar canchas de tenis

Los tipos de cancha son un **catálogo** (tabla `tipos_cancha`, migración 004), no un enum. Agregar tenis **no requiere código ni migración**:

1. El gerente general entra a **Canchas → Tipos** y crea el tipo *Tenis* (con imagen opcional). Equivale a `POST /tipos-cancha`.
2. El gerente de cada sede da de alta las canchas de tenis con su precio por hora (`POST /canchas` con el `tipoId` de Tenis).
3. Desde ese momento aparecen en la grilla de reserva, con el mismo precio dinámico (descuento de socio y hora pico), el mismo control de concurrencia y el mismo comprobante.

Lo que **sí** requeriría cambios, si el negocio lo pide:

| Necesidad | Dónde cambiar |
|---|---|
| Turnos de 90 minutos para tenis | `canchas/turnos-cancha.ts` fija turnos de 1 h en punto. Habría que agregar la duración al tipo (columna `duracion_minutos` en `tipos_cancha`, con su migración y reversión), usarla en `turnosDelDia()` y `esTurnoValido()`, y reemplazar el índice único por igualdad de hora de inicio por una **restricción de exclusión sobre el rango horario**, porque dos turnos superpuestos podrían empezar a horas distintas (ver ADR-004) |
| Precio distinto en hora pico para tenis | Una estrategia nueva (7.2) que mire el tipo en el contexto |

### 7.2 Caso resuelto: agregar una estrategia de precio

Ejemplo: **descuento del 10 % de lunes a jueves antes de las 12:00** (*horario valle*).

**1. Extender el contexto** con el dato que necesita la estrategia (`pricing-strategy.interface.ts`):

```ts
export interface PricingContext {
  esSocioActivo: boolean;
  esHoraPico: boolean;
  esHorarioValle: boolean; // nuevo
}
```

y calcularlo donde se arma el contexto, en `ReservasCanchaService.calcularPrecio()` (`canchas/reserva-cancha.service.ts`). Ese método arma `esSocioActivo` y llama a `pricingCalculator.esHoraPico(horaInicio)` para `esHoraPico` (`reserva-cancha.service.ts:255`); la nueva bandera se calcula en el mismo lugar. Hoy el método recibe la cancha, el usuario y la hora de inicio; hay que sumarle la fecha del turno para saber el día de la semana (en hora de Argentina, con `diaSemanaDe()` de `common/helpers/hora-argentina.helper.ts`).

**2. Crear la estrategia** (`canchas/pricing/valley-hour-pricing.strategy.ts`):

```ts
@Injectable()
export class ValleyHourPricing implements PricingStrategy {
  private readonly DESCUENTO = 0.1;

  aplica(context: PricingContext): boolean {
    return context.esHorarioValle;
  }

  calcular(precioBase: number): number {
    return precioBase * (1 - this.DESCUENTO);
  }
}
```

**3. Registrarla** en `canchas.module.ts`: agregarla a `providers` y al arreglo de `PRICING_STRATEGIES`. El orden del arreglo es el orden de aplicación:

```ts
{
  provide: PRICING_STRATEGIES,
  useFactory: (socio: MemberDiscountPricing, pico: PeakHourPricing, valle: ValleyHourPricing) =>
    [socio, pico, valle],
  inject: [MemberDiscountPricing, PeakHourPricing, ValleyHourPricing],
}
```

**4. Registrar el resultado.** La reserva guarda qué estrategia se aplicó en `estrategia_precio`, un ENUM. Hay que agregar el valor (por ejemplo, `HORARIO_VALLE`) en `entities/enums.ts`, en `frontend/src/shared/types/enums.ts` y en una migración nueva:

```sql
-- backend/db/sql/013-estrategia-horario-valle.sql
-- migrar:sin-transaccion
ALTER TYPE public.tipo_estrategia_precio ADD VALUE IF NOT EXISTS 'HORARIO_VALLE';
```

y ampliar el mapeo al final de `PricingCalculatorService.calcular()`.

**5. Probar** en `canchas/reserva-cancha.service.spec.ts`: un turno valle sin socio (−10 %), uno valle con socio (se acumulan), y uno fuera de horario (no aplica).

Ni `ReservasCanchaService` ni el repositorio cambian: esa es la ventaja del patrón.

**Deuda conocida:** el contexto identifica las estrategias aplicadas por el nombre de la clase para elegir el valor del ENUM. Con más estrategias convendría que cada una declare su propio código.

## 8. Pruebas: cómo correrlas y cómo leer la cobertura

Estrategia completa en ADR-008.

| Nivel | Comando (desde `backend/`) | Qué cubre |
|---|---|---|
| Unitarias | `npm test` | Reglas de negocio con dobles en memoria (más de 700 casos) |
| Unitarias con cobertura | `npm run test:cov` | Igual, con informe en `backend/coverage/` y umbral |
| Integración | `npm run test:integracion` | RN-01, RN-02, cupo de clases y ocurrencias contra Postgres real |
| Sistema | job `docker` del CI | `docker compose up --build` y verificación de portal, API y datos |

Para la integración hace falta un Postgres de prueba. **El script borra y recrea la base indicada**, por eso exige `INTEGRACION_DB=true` y se niega a correr contra un host de Supabase:

```bash
docker compose up -d db
INTEGRACION_DB=true DB_HOST=localhost DB_PORT=5433 DB_USERNAME=fitzone \
  DB_PASSWORD=fitzone-local DB_NAME=fitzone DB_SSL=false npm run test:integracion
```

**Leer la cobertura:** abrir `backend/coverage/lcov-report/index.html`. El umbral mínimo está en `coverageThreshold` de `backend/package.json` (70 % de sentencias y líneas, 60 % de ramas, 55 % de funciones) y excluye archivos sin lógica (módulos, DTOs, entidades, `main.ts`). Si el resultado queda por debajo, `npm run test:cov` falla y el CI bloquea el merge.

## 9. Pipeline de integración y entrega continuas

Archivo: `.github/workflows/ci.yml`. Se ejecuta en cada push y pull request a `main`.

| Job | Pasos | Falla si |
|---|---|---|
| `secretos` | gitleaks sobre todo el historial | Hay una credencial versionada |
| `servidor` | `npm ci`, `tsc --noEmit`, pruebas con cobertura, `npm run build`, `npm run swagger:export` y comparación | Error de tipos, prueba roja, cobertura bajo el umbral o `swagger.json` desactualizado |
| `integracion` | Servicio `postgres:17`, pruebas de integración, revertir todas las migraciones y volver a aplicarlas con el seed | Falla una regla bajo concurrencia o una migración no es reversible |
| `docker` | `docker compose up --build --wait`, chequeo de portal, API, Swagger y 25 sedes | El sistema no levanta desde cero |
| `cliente` | `npm ci`, `tsc -b`, `vite build` | El portal no compila |

Con la protección de la rama `main` configurada para exigir estos checks, un pull request no se puede mergear con el pipeline en rojo. Después del merge, Render y Vercel despliegan automáticamente. Ver el [diagrama](../diagramas/pipeline.svg).

**Contrato OpenAPI:** si se cambia un endpoint, regenerar `backend/swagger.json` con `npm run swagger:export` y versionarlo junto con el cambio.

## 10. Convenciones de código, ramas y mensajes de commit

**Código:**

- TypeScript estricto en los dos proyectos; ESLint y Prettier (`npm run lint`, `npm run format` en `backend/`).
- Nombres de dominio en español (`reservarSegura`, `fechaInicio`); los términos técnicos del framework quedan en inglés (`Controller`, `Service`, `Repository`).
- Los comentarios explican el porqué, no el qué.
- Validación de entrada con DTOs y `class-validator`; el servidor nunca confía en montos ni identidades que vengan del cliente (ADR-016).
- Errores con las excepciones HTTP de Nest; los mensajes son para el usuario final, en español y sin datos de otros usuarios.

**Ramas:**

- `main` siempre desplegable y protegida.
- Una rama por tarjeta: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`.
- Se integra por pull request con el CI en verde.

**Mensajes de commit** (Conventional Commits, en español):

```
tipo(ámbito): resumen en imperativo y minúscula [FT1-nn]

Cuerpo opcional: qué cambia y por qué.
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `build`, `chore`. Ámbito: el módulo (`acceso`, `canchas`, `cliente`, `db`…). La referencia a la tarjeta del tablero va entre corchetes. No se aceptan mensajes genéricos como «cambios» o «fix».
