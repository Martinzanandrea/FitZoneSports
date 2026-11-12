# FitZone Sports

## 1. Qué es

FitZone Sports es la plataforma de gestión de una cadena de gimnasios con más de 25 sedes. Los socios pagan su membresía, entran a cualquier sede mostrando un código QR que cambia cada minuto, reservan clases grupales y alquilan canchas de paddle y fútbol 5. El personal de cada sede valida los ingresos, controla cuánta gente hay dentro y cobra en el mostrador, y la gerencia administra sedes, precios y reportes de toda la cadena. Es una aplicación web que se usa desde la computadora o el teléfono, donde también se puede instalar como aplicación.

Proyecto académico de la cátedra de Programación V, Licenciatura en Sistemas de Información (Facultad de Ciencias de la Administración, UNER).

## 2. Integrantes

| Integrante | Rol | Usuario de Git |
|---|---|---|
| Zanandrea, Martín | Backend, líder técnico | `martin` / `Martin Zanandrea` (martinzanandrea09@gmail.com) |
| Ava, Teo | Frontend | `Teo` (teoava3@gmail.com) |
| Retamoso, Máximo | Calidad, DevOps y documentación | `maxi` (maxiretamosotrotta@gmail.com) |

El equipo está formado por estos tres integrantes. Las responsabilidades de cada uno por tarjeta están en [`docs/planificacion/PLANIFICACION.md`](docs/planificacion/PLANIFICACION.md) y su trabajo en commits está en las [bitácoras](docs/bitacoras/).

## 3. Puesta en marcha

Requisitos: Git y Docker con Compose v2 (Docker Desktop en Windows y macOS).

```bash
git clone https://github.com/Martinzanandrea/FitZoneSports.git
cd FitZoneSports
docker compose up --build
```

Cuando termina de levantar, abrir **http://localhost:8080**. La API queda en http://localhost:3000 y Swagger UI en **http://localhost:3000/api**.

La primera vez la API crea la base y carga los datos de prueba (25 sedes con canchas, clases y usuarios de todos los roles). No hace falta ninguna cuenta externa. Para empezar de cero: `docker compose down -v`.

Instalación sin Docker, producción y variables de entorno: [manual de instalación y operación](docs/manuales/manual-de-instalacion-y-operacion.md).

## 4. Usuarios de prueba

Todos usan la contraseña **`FitZone2026!`**. Son datos ficticios que carga el seed; no existen en producción.

| Rol | Email | Dónde ingresar |
|---|---|---|
| Gerente general | `gerente@fitzone.test` | http://localhost:8080/admin/login |
| Gerente de sede (sede 1, Paraná Centro) | `gerente.sede1@fitzone.test` | http://localhost:8080/admin/login |
| Recepcionista (sede 1, Paraná Centro) | `recepcion1@fitzone.test` | http://localhost:8080/admin/login |
| Socio al día | `socio1.1@fitzone.test` | http://localhost:8080/login |
| Socio con la cuota vencida (paga tarifa de externo, RN-03) | `socio1.3@fitzone.test` | http://localhost:8080/login |
| Cliente externo | `externo1@fitzone.test` | http://localhost:8080/login |

Cada una de las 25 sedes tiene su gerente, su recepcionista, cuatro socios y un externo: cambiando el número (`recepcion7@…`, `socio7.2@…`) se usa otra sede.

## 5. Documentación

| Documento | Ubicación |
|---|---|
| Registros de decisión arquitectónica (ADR-001 a ADR-023) | [`docs/adr/`](docs/adr/README.md) |
| Diagramas C4, DER físico, despliegue y pipeline (fuente y exportación) | [`docs/diagramas/`](docs/diagramas/README.md) |
| Manual de usuario | [`docs/manuales/manual-de-usuario.md`](docs/manuales/manual-de-usuario.md) |
| Manual de instalación y operación | [`docs/manuales/manual-de-instalacion-y-operacion.md`](docs/manuales/manual-de-instalacion-y-operacion.md) |
| Manual técnico | [`docs/manuales/manual-tecnico.md`](docs/manuales/manual-tecnico.md) |
| Bitácoras individuales | [`docs/bitacoras/`](docs/bitacoras/) |
| Planificación del proyecto | [`docs/planificacion/`](docs/planificacion/) |
| Evidencia de requisitos no funcionales | [`docs/rnf/`](docs/rnf/) |
| Contrato de la API (OpenAPI) | [`backend/swagger.json`](backend/swagger.json) |

## 6. Estado de las pruebas

| Suite | Comando | Resultado |
|---|---|---|
| Unitarias del backend | `npm test` (en `backend/`) | 848 pruebas en 42 suites, todas en verde |
| Integración contra PostgreSQL (RN-01, RN-02, cupo de clases, sincronización offline) | `npm run test:integracion` (en `backend/`) | 18 pruebas en 5 suites. Requieren una base PostgreSQL y no se corrieron en esta revisión; las corre el job `integracion` del CI |
| Unitarias del frontend | `npm test` (en `frontend/`) | 153 pruebas en 7 archivos, todas en verde |
| Sistema (`docker compose up --build`) | job `docker` del CI | Levanta y responde en el CI; no se corrió localmente en esta revisión |

**Cobertura** de las pruebas unitarias del backend: **73,65 % de sentencias**, 64,30 % de ramas, 58,99 % de funciones y 73,88 % de líneas. El frontend no tiene umbral ni informe de cobertura. El umbral mínimo (70 / 60 / 55 / 70 %) está declarado en [ADR-008](docs/adr/ADR-008-estrategia-de-pruebas.md) y el CI falla si no se alcanza. Informe detallado: `npm run test:cov` y abrir `backend/coverage/lcov-report/index.html`.

El pipeline de GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) corre en cada push y pull request a `main`: escaneo de secretos, tipos, pruebas con umbral de cobertura, build, contrato OpenAPI, pruebas de integración con migraciones reversibles, levantado con Docker, y pruebas y build del portal.

---

## Demo en vivo

[https://fit-zone-sports.vercel.app](https://fit-zone-sports.vercel.app)

El backend corre en un plan gratuito de Render, que suspende el servicio tras períodos de inactividad. La primera petición después de un tiempo sin uso puede tardar unos segundos.

## Stack técnico

- **Backend:** NestJS 11, TypeScript, TypeORM, PostgreSQL 17, Passport/JWT. Monolito modular ([ADR-001](docs/adr/ADR-001-estilo-arquitectonico.md)).
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, React Router. PWA instalable ([ADR-011](docs/adr/ADR-011-pwa-en-lugar-de-app-nativa.md)).
- **Infraestructura:** Docker Compose (desarrollo y corrección); Render, Vercel, Supabase y Brevo (producción).
- **Patrones:** Strategy (precio dinámico de canchas), Observer (lista de espera), Repository (reservas sin sobreventa), además de Factory, Facade, Adapter y State. Detalle en el [manual técnico](docs/manuales/manual-tecnico.md#4-patrones-de-diseño-aplicados-y-su-ubicación-en-el-código).

## Estructura del repositorio

```
backend/    API NestJS, migraciones (db/), pruebas de integración (test/), swagger.json
frontend/   portal del socio y consola de administración (React)
docs/       adr, diagramas, manuales, bitácoras, planificación, rnf
docker-compose.yml
```

La correspondencia entre la estructura del frontend y la del punto 4 de los lineamientos está en [docs/entregables/estructura-frontend.md](docs/entregables/estructura-frontend.md).

## Declaración de uso de asistentes de IA y de bibliotecas de terceros

**Asistentes de IA.** El equipo usó asistentes de inteligencia artificial como apoyo durante el desarrollo, las pruebas y la redacción de documentación. Se usó Claude Code (Anthropic) en este repositorio. Los integrantes revisaron el código y los documentos que entregan y pueden explicarlos y modificarlos en la defensa. [Pendiente: cada integrante debe confirmar si usó otros asistentes y para qué tareas.]

**Bibliotecas de terceros.** Todas se instalan con `npm ci` desde los `package-lock.json`; las versiones exactas están ahí.

- **Backend:** NestJS 11 (`@nestjs/common`, `core`, `config`, `jwt`, `passport`, `swagger`, `throttler`, `typeorm`, `schedule`, `event-emitter`, `platform-express`), TypeORM, `pg`, Passport, `bcrypt`, `class-validator`, `class-transformer`, `helmet`, `cookie-parser`, `multer`, `nodemailer`, `web-push`, `pdfkit`, `@supabase/supabase-js` y RxJS. Pruebas y calidad: Jest, ts-jest, supertest, ESLint y Prettier.
- **Frontend:** React 19, React Router, Vite, Tailwind CSS 4, `axios`, `html5-qrcode`, `qrcode.react`, `lucide-react`, `vite-plugin-pwa` y `@vercel/analytics`. Pruebas y calidad: Vitest, jsdom, `fake-indexeddb` y ESLint.
- **Servicios externos:** Supabase (PostgreSQL y Storage), Render, Vercel y Brevo (correo). La pasarela de pagos es simulada.
- **Material de terceros:** [Pendiente: el equipo debe indicar la procedencia y la licencia de las imágenes de `frontend/public/images/landing/`; no se pudo verificar en el repositorio.]

## Licencia

Este proyecto se distribuye bajo la licencia MIT, a nombre de "Equipo FitZone Sports" (2026). El texto completo está en [`LICENSE`](LICENSE).
