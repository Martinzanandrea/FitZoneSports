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
| Node.js | 20 LTS (probado también con 24) |
| npm | 10 o superior |
| PostgreSQL | 17 (cualquier 15+ con la extensión `btree_gist`) |

**Imágenes que usa el compose:** `postgres:17`, `node:20-bookworm-slim` (API) y `nginx:1.27-alpine` (portal).

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
| API | Render (Web Service) | *Root Directory* `backend`; build `npm ci && npm run build`; start `npm run start:prod`; Node 20 |
| Base de datos y archivos | Supabase | Postgres 17 con el pooler; buckets `fotos-usuarios` y `comprobantes` |
| Correo | Brevo | API HTTPS (Render bloquea SMTP) |

Pasos para un entorno nuevo:

1. Crear el proyecto de Supabase y los dos buckets públicos.
2. Aplicar el esquema: desde una máquina con acceso, `cd backend && npm run db:migrar` con las variables de Supabase en `.env`.
3. Crear el servicio en Render con las variables de la sección 4 (`NODE_ENV=production`, `MAIL_PROVIDER=brevo`).
4. Crear el proyecto en Vercel apuntando a `frontend`, con `VITE_API_URL=/api`, y ajustar el destino del rewrite en `vercel.json` a la URL de Render.
5. En Render, `FRONTEND_URL` debe ser la URL de Vercel (CORS).

Cada merge a `main` despliega automáticamente en Render y Vercel, después de que el CI pasa (sección 6).

> La base de Supabase existente se creó a mano antes de que existiera el script de migraciones. Antes de usar `db:migrar` contra ella por primera vez, registrar las migraciones ya aplicadas con `node db/migrar.js marcar-aplicadas`.

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
| `JWT_SECRET` | Sí | cadena larga aleatoria | Firma de la sesión y del QR |
| `JWT_EXPIRATION` | No | `8h` | Duración de la sesión |
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

`DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_PUERTO_HOST`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`. Ver `.env.example` en la raíz. Sin ese archivo se usan valores de desarrollo.

**Nunca se versionan archivos `.env`**: solo los `.env.example`, sin valores reales.

## 5. Base de datos: migraciones, reversión y datos semilla

Las migraciones son scripts SQL en `backend/db/sql/NNN-nombre.sql`; cada una tiene su reversión en `backend/db/sql/reversion/NNN-nombre.down.sql`. El script `backend/db/migrar.js` registra cuáles se aplicaron en la tabla `schema_migraciones`. Los scripts con `diagnostico` en el nombre son consultas de solo lectura para revisar datos a mano y no se ejecutan como migraciones.

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

**Agregar una migración:** crear `backend/db/sql/012-descripcion.sql` y `backend/db/sql/reversion/012-descripcion.down.sql`. Si usa `ALTER TYPE ... ADD VALUE`, separar las sentencias con `-- migrar:corte` y marcar el archivo con `-- migrar:sin-transaccion`.

El CI aplica todas las migraciones en una base vacía, las revierte todas y las vuelve a aplicar en cada push.

## 6. Despliegue: estrategia adoptada y procedimiento de reversión

**Estrategia:** integración continua en GitHub Actions y despliegue automático en Render y Vercel al hacer merge en `main`. El pipeline (`.github/workflows/ci.yml`) tiene cinco jobs: escaneo de secretos, servidor (tipos, pruebas con umbral de cobertura, build y `swagger.json` al día), integración contra Postgres, Docker compose y cliente. Ver el [diagrama del pipeline](../diagramas/pipeline.svg).

**Reversión de la aplicación:**

1. **Render:** panel del servicio → *Events* → elegir el deploy anterior → *Rollback*.
2. **Vercel:** proyecto → *Deployments* → deployment anterior → *Promote to Production*.
3. **En el repositorio:** `git revert <commit del merge>` y push; el pipeline despliega la versión revertida.

**Reversión de la base:** primero un respaldo (sección 7), después `npm run db:revertir` con las variables de producción. Revertir datos de 008 no es posible por diseño.

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

**Estado actual:** la validación de ingresos requiere conexión con la API. Si la sede pierde internet, la pantalla de recepción muestra *Sin conexión* y deshabilita la validación hasta que vuelve la red. El resto del portal muestra el aviso de sin conexión.

**Procedimiento mientras dure la caída:**

1. Registrar a mano (planilla) nombre, DNI y hora de cada ingreso.
2. Verificar la membresía mirando la tarjeta del socio en su teléfono (fecha *Válida hasta*).
3. Al volver la conexión, registrar los ingresos con el modo **DNI** de Control de acceso.

**Validación offline en el terminal de sede:** está en desarrollo (RNF-01). El diseño está en [ADR-003](../adr/ADR-003-estrategia-offline-del-acceso.md) y [ADR-007](../adr/ADR-007-sincronizacion-del-terminal-de-sede.md): QR firmado verificable con clave pública, copia local de vigencias y cola de ingresos que se sincroniza al reconectar. Cuando se integre, esta sección se actualiza con el procedimiento definitivo.

**Caída de la API o de la base:** el portal sigue cargando (es estático, servido por Vercel o nginx) pero no puede operar. Revisar la sección 10 y, si fue un despliegue, revertir (sección 6).

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
| Respuestas 429 *Too Many Requests* | Límite de 200 pedidos por minuto por IP (5 por minuto en el login) | Esperar un minuto |
