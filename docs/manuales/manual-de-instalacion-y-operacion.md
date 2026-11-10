# Manual de instalación y operación — FitZone Sports

**Versión:** 1.0 · **Fecha:** 2026-11-09 · **Aplica a:** tag `v1.0-entrega`

Este manual permite levantar el sistema desde cero, configurarlo, operarlo y recuperarlo ante fallas. Las decisiones detrás de cada procedimiento están en [ADR-009](../adr/ADR-009-despliegue-contenerizacion-y-reversion.md) (despliegue y reversión) y [ADR-023](../adr/ADR-023-almacenamiento-de-archivos-intercambiable.md) (archivos).

---

## 1. Requisitos previos · Versiones exactas de software

**Para levantar el sistema con Docker (recomendado):**

| Software | Versión | Para qué |
|---|---|---|
| Docker Engine | 24 o superior | Contenedores |
| Docker Compose | v2.20 o superior (`docker compose`, con espacio) | Orquestación; se usa `--wait` |
| Git | 2.40 o superior | Clonar el repositorio |

Docker Desktop incluye Engine y Compose en Windows y macOS.

**Para desarrollar sin Docker:**

| Software | Versión |
|---|---|
| Node.js | 22 LTS o superior (el CI y las imágenes usan 22; probado también con 24) |
| npm | 10 o superior |
| PostgreSQL | 17 (cualquier 15+ con la extensión `btree_gist`) |

**Imágenes que usa el compose:** `postgres:17`, `node:22-bookworm-slim` (API y compilación del portal) y `nginx:1.27-alpine` (portal).

**Puertos que deben estar libres:** 8080 (portal), 3000 (API) y 5433 (Postgres en la máquina).

## 2. Puesta en marcha en entorno de desarrollo

### 2.1 Con Docker (un comando)

```bash
git clone https://github.com/Martinzanandrea/FitZoneSports.git
cd FitZoneSports
docker compose up --build
```

La primera vez tarda unos minutos (descarga imágenes e instala dependencias). Cuando termina:

| Servicio | URL |
|---|---|
| Portal del socio y consola | http://localhost:8080 |
| API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api |

Al arrancar, la API **aplica las migraciones pendientes** y **carga los datos de prueba** si la base está vacía (25 sedes, canchas, clases y usuarios de todos los roles). Las credenciales de prueba están en el README.

El compose **no necesita Supabase ni cuentas externas**: los archivos se guardan en un volumen local y los links de verificación de email se imprimen en el log de la API (`docker compose logs api`).

Para bajar todo: `docker compose down`. Para bajarlo **y borrar la base** (vuelve a cargar los datos de prueba al próximo arranque): `docker compose down -v`.

### 2.2 Sin Docker

**API:**

```bash
cd backend
npm ci
cp .env.example .env      # completar las variables (sección 4)
npm run db:migrar         # crea el esquema
npm run db:seed           # datos de prueba (opcional)
npm run start:dev         # http://localhost:3000, Swagger en /api
```

Para un Postgres local sin SSL, en `.env` poner `DB_SSL=false`. Para no depender de Supabase, `STORAGE_PROVIDER=local`.

**Portal:**

```bash
cd frontend
npm ci
echo "VITE_API_URL=http://localhost:3000" > .env
npm run dev               # http://localhost:5173
```

## 3. Puesta en marcha en entorno de producción

La producción actual corre en planes administrados:

| Componente | Plataforma | Configuración |
|---|---|---|
| Portal | Vercel | Proyecto con *Root Directory* `frontend`; build `npm run build`; salida `dist`. `vercel.json` reenvía `/api/*` a la API |
| API | Render (Web Service) | *Root Directory* `backend`; build `npm ci && npm run build`; start `npm run start:prod`; Node 22 |
| Base de datos y archivos | Supabase | Postgres 17 con el pooler; buckets `fotos-usuarios` y `comprobantes` |
| Correo | Brevo | API HTTPS (Render bloquea SMTP) |

Pasos para un entorno nuevo:

1. Crear el proyecto de Supabase y los dos buckets públicos.
2. Aplicar el esquema: desde una máquina con acceso, `cd backend && npm run db:migrar` con las variables de Supabase en `.env`.
3. Crear el servicio en Render con las variables de la sección 4 (`NODE_ENV=production`, `MAIL_PROVIDER=brevo`).
4. Crear el proyecto en Vercel apuntando a `frontend`, con `VITE_API_URL=/api`, y ajustar el destino del rewrite en `vercel.json` a la URL de Render.
5. En Render, `FRONTEND_URL` debe ser la URL de Vercel (CORS).
6. Generar la clave del QR y cargarla en Render (sección 3.1).
7. Aplicar la migración 012 en Supabase (sección 3.2).

**Despliegue automático.** El despliegue automático de Render y de Vercel al hacer merge en `main` es **configuración manual** de cada plataforma: el repositorio no versiona un `render.yaml` y, de Vercel, solo versiona `frontend/vercel.json` (reenvío de `/api` y encabezados). Que el despliegue espere a que el CI pase depende de esa configuración y no se puede comprobar desde el repositorio.

### 3.1 Clave ES256 del QR (`QR_PRIVATE_KEY`)

El QR de acceso se firma con una clave privada ES256 (curva P-256) para que el terminal de sede lo verifique sin conexión con la clave pública. Sin esta clave el sistema funciona, pero el QR se firma con HS256 y **el modo sin conexión no está disponible**.

1. Generar la clave **una sola vez**, en la máquina de quien administra el servicio, con Node (formato PKCS8 PEM):

   ```bash
   node -e "const {generateKeyPairSync}=require('node:crypto');const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});console.log(privateKey.export({type:'pkcs8',format:'pem'}))"
   ```

2. Copiar el resultado completo (desde `-----BEGIN PRIVATE KEY-----` hasta `-----END PRIVATE KEY-----`) en la variable `QR_PRIVATE_KEY` del servicio de Render. La API acepta el PEM en varias líneas o en una sola línea con `\n` literales.
3. Guardarla **solo** en las variables de entorno del hosting (y en el gestor de secretos del equipo). **Nunca** se escribe en un archivo del repositorio, en `.env.example`, en un ticket ni en un chat. No pegar la salida del comando en ningún lugar versionado.
4. Opcional: `QR_KEY_ID` fija el identificador de la clave (`kid`). Si no se define, la API usa 8 caracteres hexadecimales de un hash de la clave pública.
5. Reiniciar el servicio y verificar: `GET /acceso/clave-publica` debe responder 200 con la clave (`alg: ES256`). Una respuesta 404 indica que la clave no se cargó (sección 11).

Cambiar la clave deja sin validez la clave pública guardada en los snapshots ya descargados: hasta que cada terminal renueve su snapshot (con conexión, lo renueva cuando tiene más de 1 hora), los QR nuevos no se podrán verificar sin conexión.

### 3.2 Migración 012 (acceso sin conexión) en Supabase

La base de producción se creó a mano y la tabla `schema_migraciones` está **vacía**. Por eso en producción **no se usa `node db/migrar.js subir`** (intentaría aplicar de nuevo desde la 001). La migración 012 se aplica a mano:

1. Abrir el *SQL Editor* de Supabase.
2. Pegar el contenido de `backend/db/sql/012-acceso-offline.sql` dentro de una transacción:

   ```sql
   BEGIN;
   -- contenido completo de backend/db/sql/012-acceso-offline.sql
   COMMIT;
   ```

3. Si algún paso falla, ejecutar `ROLLBACK;`: la migración no queda a medias. El archivo **no es idempotente** (la restricción `chk_acceso_metodo_ingreso` se crea sin `IF NOT EXISTS`), por lo que no se debe aplicar dos veces.
4. Verificar que existan la tabla `eventos_acceso_offline` y las columnas `metodo_ingreso` y `observacion` de `control_acceso`.

La migración es aditiva (solo agrega columnas con valor por defecto y una tabla), de modo que la API anterior sigue funcionando con ella aplicada. Su reversión, solo si hace falta, está en `backend/db/sql/reversion/012-acceso-offline.down.sql`.

> Si más adelante se decide registrar las migraciones ya aplicadas en `schema_migraciones`, usar `node db/migrar.js marcar-aplicadas` **después** de aplicar a mano la 012, porque ese comando las marca todas como aplicadas sin ejecutarlas.

## 4. Variables de entorno: tabla completa

### API (`backend/.env`)

| Variable | Obligatoria | Valor de ejemplo | Descripción |
|---|---|---|---|
| `NODE_ENV` | Sí | `development` / `production` | En `production`: cookie `secure` y sin Swagger UI |
| `PORT` | No | `3000` | Puerto HTTP |
| `FRONTEND_URL` | Sí | `http://localhost:5173` | Origen permitido por CORS y base de los links de los mails |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Sí | | Conexión a Postgres |
| `DB_SSL` | No | `true` | `false` para un Postgres local sin SSL |
| `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS` | No | `10`, `30000`, `10000`, `30000` | Pool de conexiones |
| `JWT_SECRET` | Sí | cadena larga aleatoria | Firma de la sesión (cookie JWT). Es también la clave de respaldo del QR cuando no hay `QR_PRIVATE_KEY` (el QR se firma con HS256 y no hay modo sin conexión) |
| `JWT_EXPIRATION` | No | `8h` | Duración de la sesión |
| `QR_PRIVATE_KEY` | Sí para el modo sin conexión | PEM PKCS8 de una clave P-256 | Clave privada ES256 con la que se firma el QR (sección 3.1). Solo en las variables del hosting, nunca en el repositorio. Sin ella el QR se firma con HS256 y `GET /acceso/clave-publica` y el snapshot responden 404 |
| `QR_KEY_ID` | No | `fz-2026` | Identificador (`kid`) de la clave. Por defecto, 8 caracteres hexadecimales de un hash de la clave pública |
| `QR_CLAVE_EFIMERA` | No | `true` | Solo desarrollo: si falta `QR_PRIVATE_KEY`, genera un par de claves al arrancar. Cambia en cada reinicio y los snapshots anteriores dejan de valer. Docker compose lo activa; nunca usarlo en producción |
| `STORAGE_PROVIDER` | No | `supabase` / `local` | Dónde se guardan los archivos |
| `STORAGE_LOCAL_DIR` | Con `local` | `archivos` | Carpeta de archivos |
| `PUBLIC_API_URL` | Con `local` | `http://localhost:3000` | URL pública de la API, base de las URLs de archivos |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Con `supabase` | | Acceso a Supabase Storage |
| `SUPABASE_BUCKET_FOTOS`, `SUPABASE_BUCKET_COMPROBANTES` | No | `fotos-usuarios`, `comprobantes` | Nombres de los buckets |
| `MAIL_PROVIDER` | No | `gmail` / `brevo` | Proveedor de correo (por defecto `gmail`) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Con `gmail` | | Cuenta y contraseña de aplicación |
| `BREVO_API_KEY`, `MAIL_FROM_EMAIL` | Con `brevo` | | Clave de API y remitente verificado |
| `MAIL_FROM_NAME` | No | `FitZone Sports` | Nombre del remitente |
| `MAIL_DEV_LOG_LINKS` | No | `true` | Solo desarrollo: imprime el link de verificación en el log |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | No | | Notificaciones push. Sin ellas el canal push se desactiva y la API arranca igual. Se generan con `npx web-push generate-vapid-keys` |

### Portal (`frontend/.env`)

| Variable | Valor | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` (local) · `/api` (Vercel y Docker) | URL base de la API. Se fija en el build |

### Docker compose (`.env` en la raíz, opcional)

`DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_PUERTO_HOST`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Ver `.env.example` en la raíz. Sin ese archivo se usan valores de desarrollo. El compose define `QR_CLAVE_EFIMERA=true` para que el modo sin conexión funcione sin configurar una clave.

**Nunca se versionan archivos `.env`**: solo los `.env.example`, sin valores reales.

## 5. Base de datos: migraciones, reversión y datos semilla

Las migraciones son scripts SQL en `backend/db/sql/NNN-nombre.sql`; cada una tiene su reversión en `backend/db/sql/reversion/NNN-nombre.down.sql`. El script `backend/db/migrar.js` registra cuáles se aplicaron en la tabla `schema_migraciones`. Los scripts con `diagnostico` en el nombre (007 y 009) son consultas de solo lectura para revisar datos a mano y no se ejecutan como migraciones; por eso la tabla de abajo no los incluye y no tienen reversión.

| Comando (desde `backend/`) | Qué hace |
|---|---|
| `npm run db:estado` | Lista las migraciones aplicadas y las pendientes |
| `npm run db:migrar` | Aplica las pendientes, en orden |
| `npm run db:revertir` | Revierte la última |
| `npm run db:revertir -- 3` | Revierte las últimas 3 |
| `npm run db:seed` | Carga los datos de prueba (no hace nada si ya hay sedes) |
| `node db/migrar.js marcar-aplicadas` | Registra todas como aplicadas sin ejecutarlas (base creada a mano) |

| Migración | Contenido | Reversión |
|---|---|---|
| 001 | Esquema base | Borra el esquema completo (solo desarrollo) |
| 002 | Auditoría y trigger de pagos | Quita el trigger |
| 003 | Verificación de email | Quita la columna |
| 004 | Catálogo de tipos de cancha | Vuelve al enum fijo (aborta si hay tipos sin equivalente) |
| 005 | Roles Gerente General y de Sede | Vuelve los gerentes al rol único (los valores del enum quedan) |
| 006 | Notificaciones | Borra sus tablas |
| 008 | Redacción de secretos en auditoría | Irreversible a propósito (no se recuperan contraseñas) |
| 010 | Membresías sin superposición | Quita la restricción |
| 011 | Suscripciones push | Borra la tabla |
| 012 | Acceso sin conexión: columnas `metodo_ingreso` y `observacion` de `control_acceso` y tabla `eventos_acceso_offline` | Borra la tabla y las columnas |

**Agregar una migración:** crear `backend/db/sql/013-descripcion.sql` y `backend/db/sql/reversion/013-descripcion.down.sql`. Si usa `ALTER TYPE ... ADD VALUE`, separar las sentencias con `-- migrar:corte` y marcar el archivo con `-- migrar:sin-transaccion`.

El CI aplica todas las migraciones en una base vacía, las revierte todas y las vuelve a aplicar en cada push.

## 6. Despliegue: estrategia adoptada y procedimiento de reversión

**Estrategia:** integración continua en GitHub Actions y despliegue automático en Render y Vercel al hacer merge en `main`. El pipeline (`.github/workflows/ci.yml`) tiene cinco jobs: escaneo de secretos, servidor (tipos, pruebas con umbral de cobertura, build y `swagger.json` al día), integración contra Postgres, Docker compose y cliente. Ver el [diagrama del pipeline](../diagramas/pipeline.svg).

**Reversión de la aplicación:**

1. **Render:** panel del servicio → *Events* → elegir el deploy anterior → *Rollback*.
2. **Vercel:** proyecto → *Deployments* → deployment anterior → *Promote to Production*.
3. **En el repositorio:** `git revert <commit del merge>` y push; el pipeline despliega la versión revertida.

**Reversión de la base:** primero un respaldo (sección 7), después `npm run db:revertir` con las variables de producción. Revertir datos de 008 no es posible por diseño. En producción la reversión de una migración también se aplica a mano en el *SQL Editor* (sección 3.2), porque `schema_migraciones` está vacía.

**Docker:** para volver a una versión anterior, `git checkout v1.0-entrega` (o el tag que corresponda) y `docker compose up --build`.

## 7. Respaldo y restauración

**Producción (Supabase):** el plan incluye respaldos diarios automáticos (panel → *Database* → *Backups*). Respaldo manual:

```bash
pg_dump "postgresql://USUARIO:CLAVE@HOST:5432/postgres?sslmode=require" -Fc -f fitzone-AAAAMMDD.dump
```

**Docker:**

```bash
docker compose exec db pg_dump -U fitzone -Fc fitzone > fitzone-AAAAMMDD.dump
```

**Restauración** (en una base vacía):

```bash
pg_restore --clean --if-exists -d "<cadena de conexión>" fitzone-AAAAMMDD.dump
```

Los archivos (fotos y comprobantes) se respaldan aparte: en Supabase, descargando los buckets; en Docker, copiando el volumen `archivos`.

## 8. Operación degradada: caída de la conexión principal y resincronización

La pantalla de **Control de acceso** del recepcionista (el terminal de sede) puede validar el QR del socio sin conexión con el servidor central. El diseño está en [ADR-003](../adr/ADR-003-estrategia-offline-del-acceso.md) y [ADR-007](../adr/ADR-007-sincronizacion-del-terminal-de-sede.md), y el detalle técnico en la sección 6 del manual técnico.

### 8.1 Condiciones para que funcione

- La API tiene `QR_PRIVATE_KEY` (sección 3.1) y la migración 012 aplicada. Sin ellas no hay modo sin conexión.
- El terminal tiene un **snapshot vigente** de su sede. Lo descarga solo al abrir Control de acceso con conexión y lo renueva si tiene más de 1 hora; vale 24 horas. Para saber si hay uno vigente basta mirar el aviso de la pantalla: *Modo sin conexión* con tono de aviso indica datos vigentes; con tono de error indica que no hay datos vigentes y no se puede validar.
- Se recomienda **abrir Control de acceso con conexión al inicio de cada jornada** y dejar la pantalla abierta.
- Para recargar la página o abrirla sin conexión hace falta tener instalada la aplicación (PWA). Si no, la pantalla debe estar abierta antes de la caída.
- No cerrar sesión, no borrar los datos del navegador ni usar una ventana privada durante la caída: la cola de ingresos pendientes está en el navegador y se perdería.

### 8.2 Qué se puede hacer sin conexión

| Operación | Sin conexión |
|---|---|
| Validar QR con la cámara o por pegado | Sí, con los datos descargados. El resultado lleva la insignia *Sin conexión* |
| Ingreso por código de 6 dígitos | No (requiere al servidor): el campo queda deshabilitado con una leyenda |
| Ingreso por DNI | No (requiere al servidor) |
| Registrar egresos | No (requiere al servidor) |
| Ver el aforo | No: muestra "No se pudo cargar el aforo" |
| Abrir la aplicación | Sí, con la sesión guardada en el dispositivo (vence a las 24 horas) |

Si el servidor responde con un error de negocio (por ejemplo, membresía vencida), ese rechazo se muestra tal cual y no se valida localmente: solo la falta de respuesta, un timeout o un error 5xx activan la validación local.

### 8.3 Procedimiento durante la caída

1. Verificar el aviso *Modo sin conexión* de Control de acceso y que indique datos vigentes.
2. Validar a cada socio con la cámara o el modo *Pegado*. Si el QR es válido, el ingreso queda en la cola y el aviso muestra la cantidad de pendientes. Un socio que ya ingresó no puede volver a entrar con otro QR hasta que se registre su egreso.
3. Si el aviso indica que **no hay datos vigentes**, o para los socios que no pueden mostrar el QR, registrar a mano (planilla) nombre, DNI y hora de cada ingreso, y verificar la membresía mirando la tarjeta del socio en su teléfono (fecha *Válida hasta*).
4. No registrar egresos hasta que vuelva la conexión.

### 8.4 Resincronización al volver la conexión

1. La pantalla envía la cola sola al volver la red, y cada 30 segundos mientras queden pendientes. También se puede usar el botón **Sincronizar ahora**.
2. Con conexión, la pantalla muestra el **resumen de la última sincronización**: cantidad de ingresos creados, observados, en conflicto y rechazados, y el detalle de cada uno que no salió creado. Se cierra con el botón *Cerrar*.
3. Los ingresos registrados en papel (paso 3 de 8.3) se cargan por el modo **DNI**.

**Qué hacer según el resultado**

| Resultado | Qué significa | Qué hacer |
|---|---|---|
| Creado | El ingreso quedó registrado | Nada |
| Observado (*La membresía no estaba vigente al sincronizar* o *La sede superaba su aforo máximo*) | El ingreso se registró igual, porque la persona ya entró | Avisar a la gerencia de sede para que revise la membresía o el aforo |
| Conflicto, *El socio ya tenía un ingreso abierto* | **El ingreso offline no se registró**: el sistema ya tenía a esa persona dentro (en esta u otra sede) | Revisar en **Quién está dentro** y, si corresponde, registrar el egreso del ingreso anterior; después cargar el ingreso por el modo DNI si la persona sigue en la sede. Puede deberse a un timeout, donde el servidor sí había registrado el ingreso original |
| Conflicto, *El código QR ya había sido registrado* | Ese QR ya se había usado | Confirmar que no sea un intento de reutilizar el QR. Si el socio está dentro, registrarlo por DNI |
| Rechazado (*QR no válido*, *fuera de la vigencia del código QR*, *más de 72 horas de antigüedad*, *usuario inexistente*) | El servidor no aceptó el evento | Registrar el ingreso por el modo DNI si la persona entró, y avisar a la gerencia si el motivo es *no válido* |
| *N ingreso(s) no pudieron enviarse porque el servidor rechazó el formato* | El pedido tiene datos inválidos; no se reintenta solo. Los eventos quedan guardados en el dispositivo | Avisar al equipo técnico; no borrar los datos del navegador |
| Sincronización interrumpida | Se cortó la red, la sesión no fue aceptada o el servidor falló | Se reintenta sola. Si el motivo es la sesión, volver a iniciar sesión |

Un conflicto **no genera una notificación**: solo queda en el resumen de la pantalla y en la tabla `eventos_acceso_offline`. Para revisarlos desde la base (solo lectura):

```sql
SELECT recibido_en, sede_id, estado, codigo, mensaje
FROM eventos_acceso_offline
WHERE estado <> 'CREADO'
ORDER BY recibido_en DESC;
```

### 8.5 Caída de la API o de la base

El portal sigue cargando (es estático, servido por Vercel o nginx) pero no puede operar, salvo la validación sin conexión de 8.2. Revisar la sección 10 y, si fue un despliegue, revertir (sección 6).

## 9. Alta de una sede nueva sin detener el sistema

Las sedes son datos, no configuración: no hace falta reiniciar ni desplegar.

1. El gerente general crea la sede en la consola (**Sedes → Nueva sede**) con su aforo y franjas horarias. También por API: `POST /sedes` y `POST /sedes/:id/franjas`.
2. Carga canchas y clases (las ocurrencias de las próximas 4 semanas se generan solas).
3. Crea el gerente de sede y los recepcionistas, asignados a la sede.
4. El recepcionista ya puede validar ingresos en la sede nueva, y los socios de cualquier sede pueden entrar.

## 10. Monitoreo: registros, métricas y verificación de estado

| Qué | Dónde |
|---|---|
| Estado de la API | `GET /` responde 200. Es el chequeo de salud del contenedor en Docker |
| Logs de la API | Render → *Logs*; en Docker, `docker compose logs -f api` |
| Logs del portal | Vercel → *Deployments* → *Functions/Logs* |
| Base de datos | Supabase → *Reports* (conexiones, consultas lentas) |
| Métricas de negocio | Consola → **Panel** y **Reportes** (ingresos, aforo, membresías) |
| Auditoría | Tabla `auditoria` (acciones sensibles por usuario) y consola → *Actividad reciente* |
| Estado de un despliegue | GitHub → *Actions* (los cinco jobs del CI) |

Los logs nunca imprimen contraseñas, tokens ni direcciones de email completas.

## 11. Resolución de problemas de instalación

| Síntoma | Causa probable | Solución |
|---|---|---|
| `port is already allocated` al hacer `docker compose up` | Otro programa usa 8080, 3000 o 5433 | Cerrar ese programa, o cambiar el puerto del lado izquierdo en `docker-compose.yml` (y `DB_PUERTO_HOST` para Postgres) |
| La API reinicia en bucle con `ECONNREFUSED` | Postgres todavía no estaba listo | El compose espera el healthcheck; si persiste, `docker compose down -v` y volver a levantar |
| `docker-entrypoint.sh: not found` | El archivo se clonó con fin de línea CRLF en Windows | El Dockerfile lo corrige al construir; si se editó a mano, guardarlo con LF (`.gitattributes` lo fuerza) |
| El portal carga pero el login falla | `FRONTEND_URL` no coincide con el origen del portal (CORS) | En Docker es `http://localhost:8080`; fuera de Docker, la URL donde corre Vite |
| La sesión se pierde al recargar en local | Cookie `secure` con HTTP | Usar `NODE_ENV=development` fuera de HTTPS |
| No llega el mail de verificación | Sin credenciales de correo | En desarrollo, `MAIL_DEV_LOG_LINKS=true` y copiar el link del log |
| `MAIL_PROVIDER=brevo requiere definir...` | Faltan variables de Brevo | Completar `BREVO_API_KEY` y `MAIL_FROM_EMAIL` |
| Error al subir una foto o al pagar | Sin Supabase configurado | `STORAGE_PROVIDER=local` |
| `db:migrar` falla en 010 | Hay membresías superpuestas en la base | Correr el diagnóstico `009-diagnostico-membresias-superpuestas.sql`, corregir los datos y reintentar |
| `GET /acceso/clave-publica` y `GET /acceso/snapshot/:sedeId` responden 404, y el terminal dice que no hay datos vigentes para validar sin conexión | La API no tiene `QR_PRIVATE_KEY` (ni `QR_CLAVE_EFIMERA=true` en desarrollo): firma el QR con HS256 | Cargar la clave (sección 3.1) y reiniciar el servicio. Los QR emitidos antes expiran a los 60 segundos y el portal genera uno nuevo firmado con ES256 |
| Tras reiniciar la API en desarrollo, los terminales pierden la validación sin conexión | Con `QR_CLAVE_EFIMERA=true` la clave cambia en cada reinicio | Esperar a que el terminal renueve su snapshot con conexión (lo hace cuando tiene más de 1 hora), o definir `QR_PRIVATE_KEY` |
| `node db/migrar.js subir` contra producción intenta crear tablas que ya existen | `schema_migraciones` está vacía en la base de Supabase | No usar `subir` en producción. Aplicar la migración a mano (sección 3.2) |
| Al aplicar 012: `constraint "chk_acceso_metodo_ingreso" already exists` | La migración ya se aplicó; no es idempotente | `ROLLBACK;` y verificar que la tabla `eventos_acceso_offline` exista. No volver a aplicarla |
| Respuestas 429 *Too Many Requests* | Límite de 200 pedidos por minuto por IP (5 por minuto en el login) | Esperar un minuto |
