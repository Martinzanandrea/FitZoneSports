# Registros de decisión arquitectónica (ADR)

Un ADR por archivo, con la plantilla del Anexo B de los lineamientos (Estado, Fecha, Autor, Sprint, Contexto, Alternativas consideradas, Decisión, Consecuencias y Requisitos relacionados). Un ADR no se corrige: se supera. Cuando una decisión se revierte, el original pasa a «Reemplazado por ADR-0NN».

## Obligatorios (ADR-001 a ADR-010)

| ADR | Decisión | Estado | Requisitos |
|---|---|---|---|
| [ADR-001](ADR-001-estilo-arquitectonico.md) | Monolito modular frente a microservicios, SOA y serverless | Aceptado | RN-02, RNF-04 |
| [ADR-002](ADR-002-motor-de-base-de-datos.md) | PostgreSQL por integridad transaccional | Aceptado | RNF-03 |
| [ADR-003](ADR-003-estrategia-offline-del-acceso.md) | Estrategia offline del control de acceso | **Propuesto** (en curso) | RNF-01 |
| [ADR-004](ADR-004-concurrencia-en-reservas.md) | Bloqueo pesimista e índice único en la reserva de canchas | Aceptado | RN-02 |
| [ADR-005](ADR-005-framework-backend-ioc-orm.md) | NestJS, contenedor de IoC y TypeORM | Aceptado | Unidad II |
| [ADR-006](ADR-006-framework-frontend-componentes-estado.md) | React, Atomic Design y estado global con Context | Aceptado | Unidad IV |
| [ADR-007](ADR-007-sincronizacion-del-terminal-de-sede.md) | Sincronización del terminal de sede | **Propuesto** (en curso) | RNF-01, RN-01 |
| [ADR-008](ADR-008-estrategia-de-pruebas.md) | Pirámide de pruebas y umbral de cobertura | Aceptado | Unidad V |
| [ADR-009](ADR-009-despliegue-contenerizacion-y-reversion.md) | Despliegue, Docker y reversión | Aceptado | Unidad V |
| [ADR-010](ADR-010-medios-de-pago-y-tokenizacion.md) | Pasarela simulada y tokenización sin datos de tarjeta | Aceptado | RNF-02 |

## Decisiones propias del desarrollo

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-011](ADR-011-pwa-en-lugar-de-app-nativa.md) | PWA en lugar de app móvil nativa | Aceptado |
| [ADR-012](ADR-012-repositorio-compartido-github.md) | GitHub como repositorio compartido (antes ADR 0001) | Aceptado |
| [ADR-013](ADR-013-modelado-de-datos.md) | Modelado de datos: UUID, sede parcial, ENUM, NUMERIC, exclusive arc (antes 0004) | Aceptado |
| [ADR-014](ADR-014-autenticacion-y-autorizacion.md) | JWT en cookie httpOnly y autorización por rol, dueño y sede (antes 0005) | Aceptado |
| [ADR-015](ADR-015-flujo-membresia-y-pago.md) | Flujo obligatorio de membresía y pago (antes 0006) | Aceptado |
| [ADR-016](ADR-016-montos-calculados-en-servidor.md) | Montos calculados en el servidor (antes 0007) | Aceptado |
| [ADR-017](ADR-017-auditoria-en-dos-capas.md) | Auditoría en dos capas (antes 0008) | Aceptado |
| [ADR-018](ADR-018-clases-recurrentes.md) | Clases como plantillas recurrentes (antes 0009) | Aceptado |
| [ADR-019](ADR-019-gmail-smtp-para-verificacion.md) | Gmail SMTP para verificación de email (antes 0010) | Reemplazado por ADR-021 |
| [ADR-020](ADR-020-jerarquia-de-roles.md) | Gerente General y Gerente de Sede (antes 0011) | Aceptado |
| [ADR-021](ADR-021-correo-con-proveedor-abstracto.md) | Correo con proveedor abstracto (antes 0012) | Aceptado |
| [ADR-022](ADR-022-vigencia-de-membresias.md) | Vigencia de membresías por fechas (antes 0013) | Aceptado |
| [ADR-023](ADR-023-almacenamiento-de-archivos-intercambiable.md) | Almacenamiento de archivos intercambiable | Aceptado |

## Renumeración

Los ADR 0001 a 0013 se renumeraron para que los diez obligatorios ocupen los números que pide la cátedra. Cada archivo conserva su historial (`git log --follow`) y una nota con su número original. El ADR 0003 (stack) se desglosó en ADR-002 (base de datos), ADR-005 (backend) y ADR-006 (frontend).
