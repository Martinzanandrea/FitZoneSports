# RNF-04 — Alta de una sede nueva sin detener el sistema

**Requisito (ADR-001):** se puede dar de alta una sede nueva sin detener el sistema.

**Estado de la evidencia:** **verificación en ejecución realizada el 12/11/2026 y pasada** contra una API y una base de datos de prueba locales (ver la sección 2 y el registro de la ejecución). Es una prueba de un solo alta con la API en marcha, con una sonda de 17 consultas; no es una prueba de carga ni de producción.

## 1. Evidencia de diseño y datos

- **Las sedes son datos, no configuración.** Se crean por API (`POST /sedes`, solo gerente general, `backend/src/sedes/sedes.controller.ts`) y se les agregan franjas horarias (`POST /sedes/:id/franjas`). No requiere reiniciar ni desplegar (manual de instalación y operación, sección 9).
- **Seed de 25 sedes.** `backend/db/seed/datos-prueba.sql` carga 25 sedes con su gerente, su recepcionista, cuatro socios y un cliente externo. Al cargarlo sobre una base creada desde cero con las migraciones del repositorio, el comando `node db/migrar.js seed` informa «Datos de prueba cargados: 25 sedes» (verificado el 11/11/2026 y de nuevo el 12/11/2026).
- Los socios de cualquier sede pueden ingresar en una sede nueva (manual de instalación y operación, sección 9, paso 4).

## 2. Verificación en ejecución

El script `medicion/verificar-alta-sede.mjs` da de alta una sede y su franja con la API en marcha, mientras una sonda consulta `GET /canchas/publico` cada 100 ms, y comprueba que la sede aparece en el listado y que una sesión iniciada antes del alta sigue válida. Escribe una sede en la base: exige `--base-de-prueba` y una API local.

```bash
node docs/rnf/medicion/verificar-alta-sede.mjs --api http://localhost:3100 --base-de-prueba
```

Guarda `medicion/resultado-alta-sede-AAAA-MM-DD.json` (este caso: `resultado-alta-sede-2026-11-12.json`). El Dossier cita ese archivo automáticamente.

**Condiciones de la ejecución:** API compilada (`dist/main.js`) en `localhost:3100` sobre un PostgreSQL 18.0 temporal local (puerto 55432) con migraciones y seed de 25 sedes; Node v24.19.0; Windows_NT 10.0.26300. No se usó Supabase ni producción.

**Resultado que escribió el script** (12/11/2026, 17:43:46 UTC, es decir 14:43 hora de Argentina):

| Medición | Valor |
|---|---|
| Sedes antes del alta | 25 |
| Alta de sede (`POST /sedes`) | 201 |
| Alta de franja horaria (`POST /sedes/:id/franjas`) | 201 |
| Sedes después del alta | 26 |
| La sede aparece en el listado | sí |
| La sesión iniciada antes del alta sigue válida | sí |
| Sonda de disponibilidad durante el alta | 17 consultas, 0 fallos |

Conclusión automática del script: «Alta de sede con el sistema en marcha: sin reinicio, sin fallos de la sonda y con la sesión previa vigente.»

**Límites:** la sonda hizo solo 17 consultas porque el alta dura poco; la API no se reinició durante la verificación pero el alcance es un único alta, sin carga concurrente, en una sola máquina.

### Registro de la ejecución

| Dato | Valor |
|---|---|
| Fecha y quién ejecutó | 12/11/2026 · Martín Zanandrea (con asistente de IA) |
| Commit probado | `31da61d` (árbol de trabajo sin cambios en archivos versionados al momento de la prueba) |
| ☑ Alta de sede y franja con código 201 | Sí: sede 201 y franja 201 |
| ☑ Sonda sin fallos durante el alta | Sí: 17 consultas, 0 fallos |
| ☑ La sede aparece en el listado | Sí: de 25 a 26 sedes y `la_sede_aparece_en_el_listado: true` |
| ☑ La sesión previa sigue válida | Sí: `sesion_previa_sigue_valida: true` |
