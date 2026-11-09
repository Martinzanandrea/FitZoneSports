# ADR-008 — Estrategia de pruebas, pirámide adoptada y umbral de cobertura

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

Hasta el sprint 6 las pruebas eran unitarias con dobles en memoria (más de 700 casos en 39 suites), con buena cobertura de reglas de negocio, pero ninguna corría contra una base real: el bloqueo de fila y los índices únicos que garantizan RN-01 y RN-02 solo se simulaban (lo advertía el ADR-022). Tampoco había un umbral de cobertura, así que el CI no bloqueaba un merge que la bajara.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Pirámide: muchas unitarias, pocas de integración con Postgres real, E2E por pipeline de Docker** | Las unitarias son rápidas y cubren reglas; las de integración prueban lo que los dobles no pueden (locks, índices); el job de Docker prueba que el sistema levanta | Las de integración necesitan una base y son más lentas | Elegida |
| Solo unitarias con dobles | Rápidas y sin infraestructura | No pueden probar concurrencia real | Deja sin verificar RN-01 y RN-02 |
| Testcontainers dentro de Jest | Cada corrida crea su propio Postgres | Requiere Docker también en la máquina de cada integrante | El servicio Postgres de GitHub Actions resuelve lo mismo en CI |
| E2E de navegador (Playwright) | Prueba el recorrido del usuario | Lento y frágil; costo alto de mantener en el plazo | Se deja como mejora; el recorrido se prueba a mano (docs/PRUEBAS.md) |

## Decisión

Adoptamos una **pirámide de tres niveles**: (1) **unitarias** (`backend/src/**/*.spec.ts`, Jest + dobles en memoria) para reglas de negocio, estrategias de precio, permisos y casos límite; (2) **integración** (`backend/test/integracion/*.int-spec.ts`) contra Postgres real con los servicios y repositorios reales, para RN-01, RN-02 y cupo de clases bajo concurrencia, preparando la base con las mismas migraciones de producción; (3) **sistema**: el job `docker` del CI levanta `docker compose up --build` y verifica portal, API, Swagger y datos de prueba. **Umbral mínimo de cobertura** de las unitarias, declarado en `coverageThreshold` de `backend/package.json`: **70 % de sentencias y líneas, 60 % de ramas y 55 % de funciones**, excluyendo archivos sin lógica (módulos de Nest, DTOs, entidades, `main.ts`, scripts). El CI falla si se incumple.

## Consecuencias

- **Positivas:** RN-01 y RN-02 quedan probadas con concurrencia real; la cobertura no puede bajar sin que el pipeline falle; el pipeline valida migraciones, contrato OpenAPI y arranque con Docker.
- **Negativas:** las pruebas de integración necesitan Postgres (en CI lo provee el servicio; en local hay que levantarlo); el umbral de funciones es bajo porque muchos controladores solo delegan.
- **Deuda asumida:** no hay pruebas automatizadas del cliente ni E2E de navegador; el umbral debería subir a medida que se cubran controladores.

## Requisitos relacionados

Unidad V, RN-01, RN-02, RNF-03

## Cómo se corren

```bash
cd server
npm test                 # unitarias
npm run test:cov         # unitarias con cobertura y umbral
INTEGRACION_DB=true DB_HOST=localhost DB_PORT=5433 DB_USERNAME=fitzone DB_PASSWORD=fitzone-local DB_NAME=fitzone_test npm run test:integracion
```
