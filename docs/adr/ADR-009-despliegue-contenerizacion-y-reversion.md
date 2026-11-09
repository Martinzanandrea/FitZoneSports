# ADR-009 — Despliegue en plataformas administradas, Docker para desarrollo y corrección, y procedimiento de reversión

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

El sistema está desplegado desde el sprint 3 en planes gratuitos: el portal en Vercel, la API en Render y la base y los archivos en Supabase. La entrega exige además que alguien ajeno al equipo pueda levantar todo con `docker compose up --build`, con esquema y datos de prueba, y un procedimiento documentado de reversión. Hasta ahora no había Dockerfiles, el esquema se aplicaba a mano en el editor SQL de Supabase y los scripts de `server/db/sql` no reproducían la base real en una base vacía.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Plataformas administradas en producción + docker compose para desarrollo y corrección** | Producción sin servidores que mantener; un solo comando reproduce el sistema completo sin cuentas externas | Dos formas de ejecutar el sistema que hay que mantener coherentes | Elegida |
| Todo en contenedores también en producción (VPS con Docker) | Mismo artefacto en todos lados | Costo y mantenimiento de un servidor propio | Fuera del presupuesto del proyecto |
| Kubernetes | Escalado y despliegues progresivos | Complejidad muy superior a la necesidad | Sobredimensionado |
| Sin Docker, solo instrucciones manuales | Nada que mantener | No cumple la condición de admisibilidad | Descartada |

## Decisión

**Producción:** Vercel (portal, con `/api` reenviado a la API), Render (API) y Supabase (Postgres y Storage), con despliegue automático al hacer merge en `main` después del CI. **Desarrollo y corrección:** `docker-compose.yml` en la raíz con tres contenedores (Postgres 17, API y portal servido por nginx con el mismo reenvío de `/api`); la API aplica las migraciones pendientes y carga los datos de prueba al arrancar, y guarda archivos en un volumen (ADR-023). **Migraciones:** `server/db/migrar.js` aplica los scripts `db/sql/NNN-*.sql` en orden y registra cada uno en `schema_migraciones`; cada uno tiene su reversión en `db/sql/reversion/NNN-*.down.sql`. **Reversión:** (1) aplicación: volver al despliegue anterior desde el panel de Render ("Rollback") y de Vercel ("Promote" del deployment previo), o `git revert` del merge; (2) base: `npm run db:revertir` deshace la última migración (o `revertir N`), previa copia de seguridad.

## Consecuencias

- **Positivas:** el sistema se reproduce en una máquina limpia con un comando; las migraciones son verificables (el CI las aplica, las revierte todas y las vuelve a aplicar); la reversión está documentada para código y para datos.
- **Negativas:** el compose no reproduce Supabase Storage ni el envío real de correo (se reemplazan por disco local y links en el log); el plan gratuito de Render suspende la API por inactividad.
- **Deuda asumida:** la base de Supabase se creó a mano: hay que marcar sus migraciones como aplicadas una vez (`node db/migrar.js marcar-aplicadas`) antes de usar el script contra producción.

## Requisitos relacionados

RNF-04, Unidad V
