# RNF-03 — Latencia de la consulta de disponibilidad

**Requisito (ADR-002):** la consulta de disponibilidad de canchas responde en milisegundos. El requisito no fija un umbral numérico.

**Estado de la evidencia:** **medida el 12/11/2026.** La consulta de disponibilidad (`GET /reservas-cancha/cancha/:canchaId/ocupacion?fecha=`) se midió con **200 repeticiones** (más 5 de calentamiento no contadas) y el resto de los endpoints con **50**. Las cifras son las que escribió el script en `medicion/resultados-latencia-2026-11-12.json` y `.md`. Es una medición por loopback con un solo cliente y sin concurrencia (ver la sección 4).

## 1. Cómo se midió

| Dato | Valor |
|---|---|
| Fecha y hora | 12/11/2026, de 18:30:16 a 18:48:09 UTC (15:30 a 15:48, hora de Argentina) |
| Repeticiones | **200** en la consulta de disponibilidad (con y sin reservas) y **50** en los demás endpoints; 5 de calentamiento no contadas en cada uno |
| Hardware | AMD Ryzen 5 5600H with Radeon Graphics, 12 núcleos lógicos, 13,9 GB de memoria, Windows_NT 10.0.26300 (x64) |
| Node | **v24.19.0** en la medición. El proyecto declara y usa **Node 22** (`engines` `>=22`, CI y Dockerfile con Node 22): la medición no se hizo con la versión del despliegue |
| PostgreSQL | 18.0 (x86_64-windows, msvc-19.44.35217), instancia temporal creada solo para la medición, en el puerto 55432 |
| Base y datos | Migraciones del repositorio y seed de 25 sedes (71 canchas, 100 clases, 800 ocurrencias de clase, 100 membresías, 176 usuarios); las tablas de reservas e ingresos arrancaron vacías |
| API | Backend compilado (`dist/main.js`) en `localhost:3100`, con `QR_CLAVE_EFIMERA=true` y `STORAGE_PROVIDER=local`, sobre esa base. No se usó Supabase ni producción |
| Método | Tiempo de pared medido en el cliente (`performance.now`) desde el envío hasta leer el cuerpo completo, por loopback, con el cliente, la API y la base en la misma máquina; percentiles por rango más cercano; solo respuestas 2xx; pausa mínima de 450 ms entre pedidos |

**Qué se mide en la consulta de disponibilidad.** Es una lectura (no escribe) sobre una cancha del seed, autenticada como socio. Se midió en dos fechas:

- **Con reservas:** la fecha de mañana (13/11/2026), en la que la propia medición había dejado 15 reservas confirmadas en esa cancha (turnos de 08:00 a 22:00). La respuesta lista 15 franjas ocupadas.
- **Sin reservas:** una fecha dentro de 30 días, sin ninguna reserva. La respuesta es una lista vacía.

Ambas respuestas se comprobaron a mano con la misma API antes de apagarla; el script solo cuenta respuestas 2xx.

## 2. Resultados

| Endpoint | Repeticiones | Muestras 2xx | Errores | p50 (ms) | p95 (ms) | Mín (ms) | Máx (ms) | Media (ms) |
|---|---|---|---|---|---|---|---|---|
| **`GET /reservas-cancha/cancha/:id/ocupacion`, fecha con reservas (disponibilidad)** | **200** | 200 | 0 | **21,20** | **22,62** | 5,39 | 24,16 | 20,68 |
| **`GET /reservas-cancha/cancha/:id/ocupacion`, fecha sin reservas (disponibilidad)** | **200** | 200 | 0 | **20,52** | **22,48** | 4,26 | 26,73 | 19,94 |
| `GET /clases` (listado de clases) | 50 | 50 | 0 | 22,48 | 24,35 | 7,09 | 25,01 | 21,54 |
| `POST /reservas-cancha` (reserva de cancha) | 50 | 50 | 0 | 35,04 | 42,65 | 21,74 | 46,80 | 34,03 |
| `GET /acceso/snapshot/:sedeId` (snapshot de acceso) | 50 | 50 | 0 | 22,33 | 23,93 | 6,75 | 24,92 | 22,20 |
| `POST /acceso/validar` (validación de QR) | 50 | 50 | 0 | 37,29 | 39,93 | 10,17 | 40,24 | 33,89 |
| `POST /auth/login` (inicio de sesión) | 50 | 50 | 0 | 62,37 | 65,34 | 58,91 | 68,17 | 62,31 |

- **Errores:** 0 en los siete endpoints. El script reintenta los 429 en lugar de registrarlos como medición y no deja un contador de ellos; terminó sin el error «429 reiterado».
- **Datos escritos por la medición** (según el propio resultado): 55 reservas de cancha, 55 ingresos y 55 registros de auditoría. La consulta de disponibilidad no escribe nada.
- Con 200 repeticiones el p95 corresponde a la muestra número 190 de las 200 ordenadas; con 50, a la número 48, por lo que los p95 de los endpoints de 50 repeticiones tienen menos resolución.

## 3. Umbral y conformidad

- **Umbral fijado por el equipo, no por el enunciado:** p95 de la consulta de disponibilidad menor o igual a 300 ms. El requisito del ADR-002 solo dice «milisegundos».
- **Resultado:** el p95 de la consulta de disponibilidad fue **22,62 ms** con reservas y **22,48 ms** sin reservas, con 200 repeticiones cada una. **Cumple el umbral propuesto** (300 ms) con un margen amplio en las condiciones medidas.
- Ningún otro endpoint medido supera el umbral: el p95 más alto es el del login (65,34 ms).
- Alcance de la conclusión: vale para las condiciones de la sección 4. No se afirma nada sobre producción ni sobre carga concurrente.

## 4. Límites de la medición

- **Node v24.19.0 en la medición frente a Node 22 del proyecto.** No se midió con la versión del despliegue.
- **Loopback y un solo cliente, sin concurrencia:** cliente, API y base están en la misma máquina, sin latencia de red, y los pedidos son secuenciales (con pausa mínima de 450 ms). No incluye Render ni Supabase.
- **Base chica:** el seed tiene 71 canchas y las tablas de reservas arrancaron vacías; en la fecha con reservas hay 15 sobre una cancha. No se midió con un volumen grande de reservas.
- **Repeticiones:** 200 en la consulta de disponibilidad y 50 en los demás endpoints (el login está limitado a 5 intentos por minuto y por sí solo toma unos 10 minutos con 50 repeticiones). No son 200 en todos.
- **El umbral de 300 ms lo fijó el equipo**; no es parte del enunciado.
- El tiempo medido incluye leer el cuerpo completo de la respuesta; no separa el tiempo de la base del de la API.

## 5. Corrida anterior del mismo día (50 repeticiones, sin la consulta de disponibilidad)

Esa misma mañana (12/11/2026, 17:28 a 17:43 UTC) se hizo una primera corrida completa, con las mismas condiciones y 50 repeticiones en los cinco endpoints que el script medía entonces. Se conserva acá porque la segunda corrida escribió sobre los archivos de resultados del día. Los valores son los que imprimió el script:

| Endpoint | Muestras 2xx | Errores | p50 (ms) | p95 (ms) |
|---|---|---|---|---|
| `GET /clases` | 50 | 0 | 22,57 | 23,83 |
| `POST /reservas-cancha` | 50 | 0 | 27,74 | 40,90 |
| `GET /acceso/snapshot/:sedeId` | 50 | 0 | 22,83 | 24,04 |
| `POST /acceso/validar` | 50 | 0 | 37,49 | 40,70 |
| `POST /auth/login` | 50 | 0 | 62,70 | 63,73 |

Los valores coinciden en orden de magnitud con los de la sección 2; la diferencia más visible está en `POST /reservas-cancha` (p50 de 27,74 ms frente a 35,04 ms), una escritura, y no se investigó la causa. Esa primera corrida **no medía la consulta de disponibilidad**, que es el objeto del requisito.

## 6. Lo que sí existe además de las cifras

- Índices en el esquema: `backend/db/sql` contiene sentencias `CREATE INDEX`, entre ellas `idx_reservas_cancha_disponibilidad` (manual técnico, sección 3). Esto explica el diseño, pero **no es una medición**.
- El script `medicion/medir-latencia.mjs` mide p50 y p95 de: login, listado de clases, reserva de cancha, consulta de disponibilidad (con y sin reservas), snapshot de acceso y validación de QR.

## 7. Historial: la corrida del 11/11

El 11/11/2026 se había levantado un PostgreSQL 18 temporal y la corrida de 200 repeticiones no terminó: el login quedó a mitad de camino cuando la base temporal dejó de responder (`ECONNREFUSED`), coincidiendo con una alerta de poca memoria del equipo. Como el script guardaba los resultados solo al final, no se conservó nada y esas cifras se descartaron. Desde entonces el script guarda un archivo parcial (`medicion/parcial-latencia.json`) después de cada endpoint y lo borra al terminar. En las corridas del 12/11 no quedó ningún archivo parcial.

## 8. Cómo reproducir

1. Crear una base **de prueba** local y cargarle migraciones y seed (`cd backend && node db/migrar.js subir && node db/migrar.js seed`, con `DB_*` apuntando a esa base y `DB_SSL=false`), o usar `docker compose up --build`.
2. Levantar la API contra esa base (`QR_CLAVE_EFIMERA=true`, `STORAGE_PROVIDER=local`). Si existe `backend/.env`, definir explícitamente todas las variables sensibles (base, Supabase, correo) para que el archivo no las complete.
3. Desde la raíz del repositorio:

   ```bash
   DB_HOST=127.0.0.1 DB_PORT=<puerto> DB_USERNAME=<usuario> DB_PASSWORD=<clave> DB_NAME=<base> DB_SSL=false \
     node docs/rnf/medicion/medir-latencia.mjs --api http://localhost:3000 --base-de-prueba \
     --repeticiones 50 --repeticiones-lectura 200
   ```

`--repeticiones-lectura` fija las repeticiones de la consulta de disponibilidad; si se omite, usa el mismo valor que `--repeticiones` (200 por defecto, y en ese caso la corrida dura cerca de una hora por el límite del login).

El script **escribe datos** (reservas, ingresos, auditoría), por eso exige `--base-de-prueba` y se niega a correr si la API o `DB_HOST` no son locales. Respeta los límites de la API (login 5 por minuto; pausa de 450 ms entre pedidos). Al terminar guarda `medicion/resultados-latencia-AAAA-MM-DD.json` y `.md`; si ya existían del mismo día, los reemplaza.
