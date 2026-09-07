# ADR 0003: Selección del stack tecnológico principal

## Estado
Aceptado

## Contexto
El equipo de 3 integrantes cuenta con experiencia previa en JavaScript y TypeScript, y dispone de un cronograma académico acotado de 16 semanas. La arquitectura de Monolito Modular (ADR 0002) requiere un framework backend con soporte robusto de módulos e inyección de dependencias. Se evaluaron alternativas en cada capa: backend (NestJS frente a Express plano o Spring Boot), frontend (React frente a Vue), motor de persistencia (PostgreSQL frente a MongoDB) y estilos (Tailwind CSS frente a CSS plano o Bootstrap).

## Decisión
Vamos a usar NestJS con TypeScript en el backend, por su soporte nativo de módulos, inyección de dependencias y decoradores, alineado directamente con la arquitectura decidida en el ADR 0002; React con Vite y TypeScript en el frontend, por la experiencia previa del equipo y su ecosistema maduro; Tailwind CSS v4 para estilos; y PostgreSQL, alojado en Supabase, como motor de persistencia compartido por todo el equipo.

## Consecuencias
Todo el equipo trabaja con el mismo lenguaje (TypeScript) en frontend y backend, reduciendo la curva de aprendizaje y facilitando la revisión cruzada de código. NestJS impone una estructura modular desde el inicio, coherente con el ADR 0002. Alojar PostgreSQL en Supabase evita que cada integrante mantenga una base de datos local desincronizada, y suma Storage para archivos sin un proveedor aparte. Como contrapartida, el equipo asumió una curva de aprendizaje inicial con los decoradores de NestJS y la sintaxis CSS-first de Tailwind v4, y el proyecto depende de la disponibilidad de un proveedor externo (Supabase) incluso durante el desarrollo local.
