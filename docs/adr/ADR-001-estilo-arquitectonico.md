# ADR-001 — Monolito modular como estilo arquitectónico

- **Estado:** Aceptado
- **Fecha:** 2026-08-24
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

FitZone Sports gestiona reservas de canchas y clases donde la sobreventa (RN-02) es un riesgo crítico de negocio, y el acceso a las sedes exige que un socio no esté en dos lugares a la vez (RN-01). Ambas reglas necesitan transacciones ACID sobre datos que comparten varios módulos (usuarios, membresías, canchas, pagos). El equipo era de cuatro integrantes con experiencia en TypeScript, el plazo era de 16 semanas y el sistema tenía que permitir sumar sedes sin detenerse (RNF-04). En el debate de la semana 1 (FT1-9) se compararon cuatro estilos.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| Microservicios | Escalado y despliegue independiente por dominio | Reservas y pagos quedan en servicios distintos: RN-02 pasa a necesitar sagas o transacciones distribuidas; mucha infraestructura para 4 personas | El costo de coordinar transacciones entre servicios supera el beneficio a esta escala |
| SOA con bus de servicios | Integración formal entre áreas | Requiere un ESB y contratos pesados; el mismo problema transaccional que microservicios | Sobredimensionado para un único producto |
| Serverless (funciones) | Sin servidores que mantener, escala a cero | Sin conexiones persistentes al pool de Postgres; los locks de reserva y el cron de ocurrencias encajan mal; arranques en frío | No se adapta a transacciones con `SELECT ... FOR UPDATE` ni a tareas programadas |
| **Monolito modular** | Una transacción ACID resuelve RN-01 y RN-02; un solo despliegue; módulos con límites claros | Se escala todo junto; un fallo no controlado afecta a todo el proceso | Elegida |

## Decisión

Usamos un **monolito modular**: una única aplicación NestJS, desplegada como un solo proceso y organizada en módulos por dominio (usuarios, membresías, acceso, clases, canchas, pagos, sedes, precios, instructores, notificaciones, auditoría, administración, autenticación), que se comunican por servicios exportados y eventos. El criterio determinante fue poder garantizar RN-02 con una transacción local y un bloqueo de fila, sin coordinar servicios.

## Consecuencias

- **Positivas:** transacciones reales para RN-01/RN-02 (ver ADR-004), despliegue simple, menor curva de aprendizaje y refactors que cruzan módulos sin versionar contratos.
- **Negativas:** escalar un módulo implica escalar toda la aplicación; un error no controlado puede afectar la disponibilidad general; la disciplina de no acoplar módulos depende del equipo, no de la red.
- **Deuda asumida:** si un módulo (por ejemplo, acceso en sede) necesitara escalar o desplegarse aparte, habría que extraerlo y reemplazar llamadas internas por una API; la división actual en módulos de Nest lo facilita.

## Requisitos relacionados

RN-01, RN-02, RNF-04

> Originalmente ADR 0002. Se pasó a la plantilla del Anexo B y se sumaron las alternativas SOA y serverless discutidas en el debate.
