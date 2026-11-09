# ADR-012 — GitHub como repositorio compartido (monorepo)

- **Estado:** Aceptado
- **Fecha:** 2026-09-04
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

El equipo necesita coordinar cambios de código realizados en paralelo por 3 integrantes sobre un mismo proyecto (frontend y backend), evitando sobrescrituras accidentales y manteniendo un historial auditable de quién hizo cada cambio.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **GitHub, monorepo** | Historial único, PR, Actions y Projects integrados | Front y back comparten historial | Elegida |
| GitLab | CI integrado equivalente | El equipo ya usaba GitHub | Sin ventaja suficiente |
| Dos repositorios (front y back) | Historiales independientes | Coordinar cambios que cruzan API y cliente en dos PR | Más fricción para un equipo de 4 |

## Decisión

Vamos a usar GitHub como repositorio remoto compartido, con Git como sistema de control de versiones, alojando en un único repositorio tanto el código de cliente como de servidor (monorepo), coordinado mediante ramas de trabajo y commits individuales por integrante.

## Consecuencias

- **Positivas:** historial auditable por autor; trabajo en paralelo por ramas.
- **Negativas:** ambos proyectos comparten historial y pipeline.
- **Deuda asumida:** si el cliente y la API se versionaran por separado, habría que dividir el repositorio.

## Requisitos relacionados

Todos (gestión)

## Detalle de las consecuencias

Todo cambio queda historizado con autor, fecha y descripción, permitiendo revertir o auditar el desarrollo en cualquier momento. El equipo puede trabajar en paralelo sobre distintas partes del sistema sin bloquearse mutuamente. Mantener frontend y backend en el mismo repositorio (monorepo) simplifica la coordinación para un equipo de este tamaño, a costa de que ambos proyectos compartan siempre el mismo historial de versiones en lugar de evolucionar de forma completamente independiente.

> Originalmente ADR 0001. Contenido sin cambios, adaptado a la plantilla del Anexo B.
