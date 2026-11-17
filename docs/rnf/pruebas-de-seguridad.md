# Pruebas de seguridad (FT1-55)

**Fecha de la revisión:** 16/11/2026 · **Commit revisado:** `91e6c8d` (rama `main`) · **Tipo de revisión:** estática, por lectura del código y de la configuración, realizada con asistencia de un asistente de IA a pedido del equipo.

**Alcance y límites.** Esta revisión **no ejecutó ataques ni pruebas dinámicas** (fuerza bruta real, fuzzing, inyección en vivo, intentos de evasión de roles contra el sistema en marcha, pruebas de carga del límite de intentos). Todo lo que figura como «cumple» indica que el código o la configuración leídos lo implementan, no que se haya probado contra el sistema desplegado. Los controles sin evidencia de ejecución se marcan **no verificado**. Las pruebas automatizadas que sí se ejecutaron (848 pruebas del backend y 170 del frontend en verde, 0 vulnerabilidades de producción en `npm audit --omit=dev`) son pruebas funcionales, no un reemplazo de una prueba de intrusión.

Leyenda: **cumple**, **parcial**, **no verificado**.

## 1. Resultados por control

| Control | Resultado | Evidencia |
|---|---|---|
| Secretos versionados | Cumple | Solo hay archivos `.env.example` versionados (raíz, `backend/`, `frontend/`). Un `git grep` de patrones de claves, tokens y cadenas de conexión halló únicamente una constante de prueba en `backend/src/common/mail/brevo.enviador.spec.ts:4`, ya documentada en [`escaneo-secretos.md`](escaneo-secretos.md), que además escanea el historial completo. El job `secretos` del CI corre gitleaks sobre todo el historial (`.github/workflows/ci.yml`). Un escaneo manual del 09/11/2026 recorrió los 112 commits de todas las ramas y todos los hallazgos fueron falsos positivos de prueba: constantes de test, la contraseña del Postgres efímero del CI, los valores por defecto de desarrollo de `docker-compose.yml` y el hash bcrypt del seed. Si alguna vez se versionara una clave real, borrarla del archivo no alcanza porque queda en el historial: hay que rotarla en el proveedor. Los valores de `docker-compose.yml` no se transcriben en este documento |
| Exclusión de `.env` | Cumple | `.gitignore` en la raíz (`.env`, `.env.*`, con excepción de `.env.example`), más `backend/.gitignore:40` y `frontend/.gitignore:28`; `backend/.dockerignore` y `frontend/.dockerignore` también excluyen `.env` y `.env.*` (salvo `.env.example`). Se comprobó con `git check-ignore` |
| Guards en los controladores | Cumple | Los 19 controladores de dominio usan `JwtAuthGuard` y `RolesGuard`, a nivel de clase o de método. Las únicas rutas sin guard son públicas y explícitas: `GET /` (`app.controller.ts`), `POST /auth/login` y `POST /auth/logout`, `GET /canchas/publico`, `GET /tipos-cancha`, `GET /precios/publico`, `GET /sedes/publico`, `GET /usuarios/verificar-email`, `POST /usuarios/reenviar-verificacion` y `POST /usuarios` (registro). Detección con un script de lectura, no con una auditoría de rutas en ejecución |
| Control por rol | Cumple | Decorador `@Roles` en los controladores revisados, evaluado por `RolesGuard` (`backend/src/auth/guards/roles.guard.ts`). En el registro público el rol lo fuerza el servicio y siempre es EXTERNO (`backend/src/usuarios/usuarios.controller.ts:127`); el cuerpo del servicio no se leyó en detalle |
| Control por sede | Parcial | `assertSedeScope` en las operaciones de acceso (`backend/src/acceso/acceso.service.ts`) y pruebas «sede ajena: 403». El alcance por sede del resto de los servicios no se auditó a fondo |
| Límite de intentos de login | Parcial | 5 intentos por minuto por IP (`backend/src/auth/auth.controller.ts:40`) y un límite global de 200 por minuto (`backend/src/app.module.ts`). No hay bloqueo por cuenta (ver sección 3). El límite no se probó con tráfico real |
| Hashing de contraseñas | Cumple | `bcrypt` con `SALT_ROUNDS = 10` (`backend/src/usuarios/usuarios.service.ts`); comparación con `bcrypt.compare` en `backend/src/auth/auth.service.ts` |
| Expiración del JWT de sesión | Parcial | `signOptions.expiresIn` lee `JWT_EXPIRATION` del entorno (`backend/src/auth/auth.module.ts`). El valor configurado en producción **no verificado** |
| Cookie de sesión | Cumple | `httpOnly`; `secure` y `sameSite: 'none'` en producción, `sameSite: 'lax'` en desarrollo (`backend/src/auth/auth.controller.ts`) |
| ValidationPipe global | Cumple | `whitelist: true` y `transform: true` (`backend/src/main.ts`); sin `forbidNonWhitelisted` global (ver sección 3) |
| CORS | Cumple | Un único origen permitido, tomado de `FRONTEND_URL` (por defecto `http://localhost:5173`), con `credentials: true` (`backend/src/main.ts`) |
| Cabeceras (Helmet) | Cumple | `helmet` aplicado en `backend/src/main.ts`; con almacenamiento local se relaja solo `crossOriginResourcePolicy` |
| Manejo de errores | Cumple | No hay un filtro propio que serialice trazas; se usan las excepciones HTTP de Nest. Las trazas (`stack`) solo se escriben en el log del servidor (`backend/src/clases/clases.service.ts`). No se provocaron errores en ejecución para comprobar el cuerpo de las respuestas |
| Subida de archivos | Cumple | Límite de 5 MB y validadores de tamaño y de tipo en `backend/src/usuarios/usuarios.controller.ts` y `backend/src/canchas/tipos-cancha.controller.ts`; el destino es el almacenamiento abstracto de [ADR-023](../adr/ADR-023-almacenamiento-de-archivos-intercambiable.md). No se probaron archivos maliciosos |
| SQL con parámetros | Cumple | El SQL crudo usa parámetros posicionales (`$1`, `$2`…, `backend/src/acceso/acceso.service.ts`) y el resto se arma con `QueryBuilder` y parámetros nombrados. Una búsqueda por patrón no halló concatenación de valores; no es una prueba exhaustiva ni una prueba de inyección |
| RNF-02: sin datos de tarjeta | Cumple | No hay campos de tarjeta (número, CVV, vencimiento) en `backend/src` ni en `frontend/src`. `PasarelaPago.procesarPago(monto, metodo)` recibe solo monto y método. En el esquema (`fitzone-estructura-20261117.sql`), el pago guarda el método y un `token_pasarela`, sin columnas de tarjeta. Detalle en [`RNF-02-sin-datos-de-tarjeta.md`](RNF-02-sin-datos-de-tarjeta.md) |
| QR de acceso firmado con ES256 | Cumple | Firma `ES256` con 60 s de vigencia (`backend/src/acceso/acceso.service.ts`). La verificación fija la lista de algoritmos y, en el modo sin conexión, exige `alg` ES256 y el `kid` esperado. Claves en `backend/src/acceso/claves-qr.service.ts`. Pruebas: «rechaza un token con alg 'none'», «rechaza otros algoritmos (HS384)», «rechaza un QR ES256 firmado con otra clave» (`acceso-offline.spec.ts`) |
| Control de repetición sin conexión | Cumple | `client_event_id` es la clave primaria de `eventos_acceso_offline` (`backend/db/sql/012-acceso-offline.sql:26`), por lo que la base impide duplicarlo. La sincronización es idempotente (pruebas «reenviar el mismo evento devuelve lo guardado y no toca nada» y «(a) reenviar el mismo lote no duplica ingresos») y el `jti` reutilizado en otro evento da `CONFLICTO` (`(c) el mismo jti en dos lotes con distinto clientEventId: CREADO y CONFLICTO / QR_REUSADO`) |
| Control de repetición en línea | Parcial | El registro de QR ya usados (`qrUsados`) está en memoria del proceso: es válido con una sola instancia del backend (ver sección 3) |
| Dependencias de producción | Cumple | `npm audit --omit=dev`: 0 vulnerabilidades en `backend/` y en `frontend/` (ejecutado el 16/11/2026 sobre el commit `91e6c8d`) |
| Protección de la rama `main` | Parcial | El equipo informa que está activa. La configuración no se puede comprobar desde el repositorio ni desde esta revisión. <!-- CONFIRMAR: Martín agrega la captura o la regla (checks obligatorios) y confirma la fecha de activación --> |
| Pruebas dinámicas (fuerza bruta, inyección, escalada de privilegios, fuzzing) | No verificado | No se ejecutaron en esta revisión |

## 2. Qué falta para cerrar FT1-55

- Ejecutar pruebas dinámicas contra un entorno de prueba (no producción): intentos de login repetidos, acceso con un rol insuficiente a cada ruta protegida, acceso a recursos de otra sede y envío de archivos no permitidos.
- Registrar el valor de `JWT_EXPIRATION` vigente en producción (sin transcribir secretos).
- Revisar el alcance por sede en los servicios que no pasan por `assertSedeScope`.

## 3. Limitaciones conocidas

Las limitaciones que afectan a la seguridad (reutilización de QR en línea con una sola instancia, límite de login por IP sin bloqueo por cuenta, `ValidationPipe` sin `forbidNonWhitelisted` global y lint del backend fuera del CI) están descritas en la [sección 11 del manual técnico](../manuales/manual-tecnico.md#11-limitaciones-conocidas).
