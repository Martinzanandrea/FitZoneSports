# ADR 0001: GitHub como repositorio compartido de control de versiones

## Estado

Aceptado

## Contexto

El equipo necesita coordinar cambios de código realizados en paralelo por 3 integrantes sobre un mismo proyecto (frontend y backend), evitando sobrescrituras accidentales y manteniendo un historial auditable de quién hizo cada cambio.

## Decisión

Vamos a usar GitHub como repositorio remoto compartido, con Git como sistema de control de versiones, alojando en un único repositorio tanto el código de cliente como de servidor (monorepo), coordinado mediante ramas de trabajo y commits individuales por integrante.

## Consecuencias

Todo cambio queda historizado con autor, fecha y descripción, permitiendo revertir o auditar el desarrollo en cualquier momento. El equipo puede trabajar en paralelo sobre distintas partes del sistema sin bloquearse mutuamente. Mantener frontend y backend en el mismo repositorio (monorepo) simplifica la coordinación para un equipo de este tamaño, a costa de que ambos proyectos compartan siempre el mismo historial de versiones en lugar de evolucionar de forma completamente independiente.
