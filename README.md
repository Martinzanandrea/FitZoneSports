# FitZone Sports

Plataforma de gestión para una cadena de gimnasios multi-sede: control de acceso, reservas de clases y canchas, membresías y pagos, con paneles diferenciados para socios, recepcionistas y gerencia.

Proyecto académico desarrollado para la cátedra de Programación V, Licenciatura en Sistemas de Información (Facultad de Ciencias de la Administración, UNER).

## Demo en vivo

[https://fit-zone-sports.vercel.app](https://fit-zone-sports.vercel.app)

El backend corre en un plan gratuito de Render, que suspende el servicio tras períodos de inactividad. La primera petición después de un tiempo sin uso puede tardar unos segundos en responder mientras el servidor se reactiva.

## Funcionalidades principales

- Control de acceso por QR dinámico, código corto de un solo uso, o validación manual, con lectura por cámara para el personal de recepción
- Reservas de clases grupales, organizadas como plantillas recurrentes con generación automática de ocurrencias, y lista de espera ante cupo completo
- Reservas de canchas deportivas (paddle, fútbol 5) con precio dinámico según horario y tipo de socio
- Gestión de membresías (alta, renovación, estados) y registro de pagos, con comprobante en PDF
- Verificación de email obligatoria al registrarse
- Paneles diferenciados por rol: Socio, Cliente Externo, Recepcionista y Gerente, cada uno con acceso limitado a lo que le corresponde
- Auditoría de operaciones sensibles

## Stack técnico

**Backend:** NestJS, TypeScript, TypeORM, PostgreSQL (Supabase), Passport/JWT

**Frontend:** React, Vite, TypeScript, Tailwind CSS, React Router

**Infraestructura:** Render (backend), Vercel (frontend), Supabase (base de datos y almacenamiento), Resend (envío de emails)

## Arquitectura

El backend está organizado como un monolito modular (13 módulos de dominio), documentado mediante diagramas C4 y Architecture Decision Records en [`docs/adr/`](docs/adr/).

Patrones de diseño aplicados:

- **Strategy** — cálculo de precio dinámico de canchas (tarifa base, descuento de socio, recargo en horario pico)
- **Observer** — notificación automática a la lista de espera cuando se libera un cupo en una clase
- **Repository** — control de concurrencia (transacción con lock) para evitar sobreventa de canchas y de cupos en clases

## Estructura del repositorio

Monorepo con dos aplicaciones independientes: `server/` (API NestJS) y `client/` (SPA React). La documentación técnica y los Architecture Decision Records viven en `docs/`.


## Licencia

Proyecto desarrollado con fines educativos en el marco de una cátedra universitaria.
