# RNF-03 — Latencia de la consulta de disponibilidad

**Requisito (ADR-002):** la consulta de disponibilidad de canchas responde en milisegundos. El requisito no fija un umbral numérico.

**Estado de la evidencia:** **sin cifras medidas registradas.** Hay un script de medición verificado en su funcionamiento, pero la corrida completa de 200 repeticiones no terminó y por eso no se guardó ningún resultado. No se escribe ninguna cifra de latencia en este repositorio.

## 1. Lo que sí existe

- Índices en el esquema: `backend/db/sql` contiene sentencias `CREATE INDEX`, entre ellas `idx_reservas_cancha_disponibilidad` (manual técnico, sección 3). Esto explica el diseño, pero **no es una medición**.
- El script `medicion/medir-latencia.mjs`, que mide p50 y p95 con 200 repeticiones (más 5 de calentamiento no contadas) de: login, listado de clases, reserva de cancha, snapshot de acceso y validación de QR.

## 2. Qué pasó con la corrida

El 11/11/2026 se levantó un PostgreSQL 18 temporal (sin tocar ninguna base existente), se aplicaron migraciones y seed del repositorio y se corrió la API local contra él. Las cuatro primeras mediciones llegaron a las 200 repeticiones; el login (límite de 5 intentos por minuto de la API, unos 42 minutos) quedó a mitad de camino cuando la base temporal dejó de responder (`ECONNREFUSED`), coincidiendo con una alerta de poca memoria del equipo. El script guardaba los resultados solo al final, de modo que **no se conservó nada** y esas cifras se descartan. Desde entonces el script guarda un archivo parcial (`medicion/parcial-latencia.json`) después de cada endpoint y tolera que la base no responda al final.

## 3. Cómo reproducir

1. Crear una base **de prueba** local y cargarle migraciones y seed (`cd backend && node db/migrar.js subir && node db/migrar.js seed`, con `DB_*` apuntando a esa base), o usar `docker compose up --build`.
2. Levantar la API contra esa base (`QR_CLAVE_EFIMERA=true`, `STORAGE_PROVIDER=local`).
3. Desde la raíz del repositorio:

   ```bash
   DB_HOST=127.0.0.1 DB_PORT=<puerto> DB_USERNAME=<usuario> DB_PASSWORD=<clave> DB_NAME=<base> DB_SSL=false \
     node docs/rnf/medicion/medir-latencia.mjs --api http://localhost:3000 --base-de-prueba
   ```

El script **escribe datos** (reservas, ingresos, auditoría), por eso exige `--base-de-prueba` y se niega a correr si la API o `DB_HOST` no son locales. Respeta los límites de la API (login 5 por minuto; pausa de 450 ms entre pedidos). Dura cerca de una hora.

Al terminar guarda `medicion/resultados-latencia-AAAA-MM-DD.json` y `.md` con: fecha, versión de Node, hardware (CPU, núcleos, memoria, sistema), versión de PostgreSQL, filas por tabla del seed antes y después, y por endpoint las muestras 2xx, los errores, p50, p95, mínimo, máximo y media. El Dossier toma esos valores directamente del JSON.

## 4. Pendiente

- Ejecutar la corrida completa y commitear los resultados.
- Si se quiere una conclusión de conformidad, el equipo debe fijar primero un umbral (por ejemplo, un p95 máximo), porque el requisito no lo define.
