# ADR-005 — NestJS como framework backend, su contenedor de IoC y TypeORM como ORM

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

El equipo tenía experiencia previa en JavaScript y TypeScript y un cronograma de 16 semanas. El monolito modular (ADR-001) necesitaba un framework con módulos e inyección de dependencias de primera clase, porque los patrones del caso (Strategy para precios, Observer para lista de espera, Repository para reservas) se apoyan en poder intercambiar implementaciones. También hacía falta un ORM con soporte de transacciones y locks para ADR-004. Esta decisión formaba parte del ADR 0003 original (stack); se separa en backend (este ADR), base de datos (ADR-002) y frontend (ADR-006).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **NestJS + TypeORM** | Módulos, IoC con tokens y `useFactory`, decoradores, guards e interceptores; TypeORM con `setLock('pessimistic_write')` y transacciones | Curva inicial de decoradores; TypeORM tiene comportamientos implícitos | Elegida |
| Express plano + Knex | Mínimo y explícito | Sin IoC: la inyección de estrategias y repositorios se hace a mano; cada integrante estructuraría distinto | Se pierde la estructura modular que pide ADR-001 |
| Spring Boot + JPA | IoC maduro, muy usado en la industria | Java: el equipo tendría dos lenguajes (front y back); más lento para iterar | Costo de aprendizaje en el plazo disponible |
| NestJS + Prisma | Tipado generado, migraciones integradas | Locks de fila y SQL específico de Postgres (índices parciales, exclusión) requieren SQL crudo | TypeORM cubría mejor `FOR UPDATE` en ese momento |

## Decisión

Usamos **NestJS 11** con TypeScript. El contenedor de IoC resuelve las variantes por token: `PRICING_STRATEGIES` (estrategias de precio), `BOOKING_CANCHA_REPOSITORY` y `BOOKING_CLASE_REPOSITORY` (implementación TypeORM o en memoria para pruebas), la fábrica de notificadores por canal, el `EnviadorCorreo` (ADR-021) y el `Almacenamiento` de archivos (ADR-023). Como ORM usamos **TypeORM** con `synchronize: false`: el esquema lo definen los scripts SQL versionados (ver ADR-009) y las entidades solo lo mapean.

## Consecuencias

- **Positivas:** todo el equipo trabaja en un solo lenguaje; los patrones de diseño se implementan con inyección en lugar de `new`, lo que permite probarlos con dobles; guards e interceptores resuelven autorización (ADR-014) y auditoría (ADR-017) de forma transversal.
- **Negativas:** decoradores y metadatos agregan magia que cuesta depurar; TypeORM no detecta solo las diferencias entre entidades y esquema real (hay que verificarlo, como se hizo al armar las migraciones).
- **Deuda asumida:** si se cambiara de ORM, los repositorios de reserva ya están detrás de interfaces, pero el resto de los servicios usa `Repository<T>` de TypeORM directamente.

## Requisitos relacionados

Unidad II, RF-11, RF-08

> Originalmente ADR 0003 (stack tecnológico). La parte de base de datos pasó al ADR-002 y la de frontend al ADR-006.
