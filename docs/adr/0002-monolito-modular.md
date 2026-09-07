# ADR 0002: Arquitectura Monolito Modular (no microservicios)

## Estado
Aceptado

## Contexto
FitZone Sports gestiona reservas de canchas y clases donde la sobreventa (RN-02) es un riesgo crítico de negocio. El equipo es reducido y el proyecto tiene un plazo académico acotado. Se evaluó una arquitectura de microservicios contra un monolito modular.

## Decisión
Utilizaremos una arquitectura de Monolito Modular: una única aplicación NestJS desplegada como un solo proceso, organizada internamente en módulos independientes por dominio (sedes, usuarios, membresías, clases, canchas, pagos, acceso, auth, admin, precios, instructores, auditoría), comunicándose entre sí de forma explícita.

## Consecuencias
Transacciones ACID reales para RN-01/RN-02 sin complejidad adicional (un SELECT FOR UPDATE dentro de una transacción resuelve la concurrencia sin coordinar servicios). Despliegue simple, menor curva de aprendizaje. Como contrapartida, escalar un módulo específico requiere escalar toda la aplicación, y un error no controlado puede afectar la disponibilidad general. Si el proyecto creciera, la división modular ya realizada facilita una futura extracción a microservicios.
