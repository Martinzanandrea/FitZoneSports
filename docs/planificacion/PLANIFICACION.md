# Plan de proyecto del Trabajo Integrador Final: caso FitZone Sports

Este documento presenta la planificación del Trabajo Integrador Final (Universidad Nacional de Entre Ríos [UNER], 2026a) y se elaboró el 09/11/2026 a partir de la exportación del tablero de Jira (proyecto FT1) y del historial del repositorio. Sus secciones siguen la plantilla de los lineamientos de entrega (UNER, 2026b).

Nota de transparencia: este plan se redactó al cierre del cuatrimestre. El tablero de Jira no registra estimaciones, horas trabajadas ni fechas de resolución, y parte de las tarjetas se creó de forma retroactiva (ver la sección 7 y el análisis de desvíos). Los datos de este documento son los que existen en el tablero; no se completaron con valores inventados.

## 1. Alcance

Incluido:

- Módulos M1 a M5 del enunciado: usuarios y membresías, acceso, clases grupales, canchas y pagos (RF-01 a RF-14), con las reglas de negocio RN-01 a RN-03 y los requisitos no funcionales RNF-01 a RNF-04.
- API REST como monolito modular (NestJS y TypeORM) sobre PostgreSQL (Supabase), con autenticación JWT, roles y alcance por sede.
- Portal responsive del socio, instalable como PWA, y consola de administración para recepción y gerencia.
- Validación del QR en el terminal de sede sin conexión (QR firmado con ES256, réplica local de socios, cola de ingresos y sincronización).
- Pasarela de pagos simulada y comprobante en PDF.
- Pipeline de integración y entrega continuas (GitHub Actions), contenedorización con Docker y documentación (ADR, diagramas, manuales).

Excluido, con su motivo:

- Aplicación móvil nativa (React Native o Flutter): se entrega el portal como PWA instalable (ADR-011) para no duplicar el cliente.
- Pasarela de pagos real y facturación fiscal: el enunciado pide una pasarela simulada.
- Cifrado del almacenamiento local del terminal y revocación de membresías en tiempo real mientras está sin conexión: la réplica local vence a las 24 horas; queda documentado como límite conocido.

## 2. Supuestos y restricciones

Supuestos:

- La infraestructura de planes gratuitos (Render, Supabase y Vercel) alcanza para la demostración.
- En el modo sin conexión, el teléfono del socio conserva datos móviles y es el terminal de la sede el que pierde la conexión.
- El reloj del dispositivo del terminal es razonablemente correcto.

Restricciones:

- Entrega del repositorio con el tag v1.0-entrega el jueves 19/11/2026 a las 18:00; la semana 16 queda para el Demo Day.
- Equipo de tres integrantes, conocido por la cátedra desde el inicio.
- Pila tecnológica asociada a las unidades de la materia (NestJS, React, PostgreSQL).

## 3. Equipo

| Integrante       | Rol                             | Horas comprometidas          | Responsabilidad principal (según las tarjetas del tablero)                                                                                     |
| ---------------- | ------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Martín Zanandrea | Backend, líder técnico          | No registradas al planificar | Usuarios y membresías, canchas, autenticación y alcance por sede, patrones Strategy, Observer y Repository, CI/CD y despliegue, acceso offline |
| Teo Ava          | Frontend                        | No registradas al planificar | Pantallas del socio y de administración, estado global, clases grupales, ADR de autenticación y de cálculo de montos                           |
| Máximo Retamoso  | Calidad, DevOps y documentación | No registradas al planificar | Acceso y pagos, pruebas de integración y QA, datos de prueba, Docker, ADR, diagramas y manuales                                                |

El código de rol P1 a P3 de cada integrante se consigna en el README del repositorio.

## 4. Estructura de desglose del trabajo

Épica, historia y subtarea según el tablero de Jira. Copiamos los estados del tablero el 13/11/2026. El tablero no registra estimaciones ni criterios de aceptación para las historias creadas antes del 09/11/2026; las tarjetas FT1-122 a FT1-132, creadas el 09/11/2026 a las 23:44, sí incluyen criterios de aceptación. Las estimaciones faltantes se analizan en la sección 8.

### FT1-1 — Unidad I — Arquitectura (Listo)

| Clave  | Historia o subtarea                                    | Responsable      | Sprint   | Estado |
| ------ | ------------------------------------------------------ | ---------------- | -------- | ------ |
| FT1-9  | Debate grupal monolito modular vs microservicios (ADR) | Máximo Retamoso  | Sprint 1 | Listo  |
| FT1-10 | Niveles C4 y ADR fundacionales                         | Teo Ava          | Sprint 1 | Listo  |
| FT1-16 | ADR - Arquitectura monolito modular                    | Máximo Retamoso  | Sprint 1 | Listo  |
| FT1-17 | ADR - Selección de stack tecnológico principal         | Martín Zanandrea | Sprint 1 | Listo  |

### FT1-2 — Unidad II — Frameworks (Listo)

| Clave  | Historia o subtarea                                                        | Responsable      | Sprint   | Estado |
| ------ | -------------------------------------------------------------------------- | ---------------- | -------- | ------ |
| FT1-11 | Scaffolding NestJS, estructura modular e inyección de dependencias         | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-14 | Documentación de la API con Swagger                                        | Teo Ava          | Sprint 2 | Listo  |
| FT1-15 | ADR - GitHub como repositorio compartido                                   | Máximo Retamoso  | Sprint 2 | Listo  |
| FT1-18 | ADR - Modelado de datos                                                    | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-19 | ADR - Autenticación JWT y autorización por rol/dueño/sede                  | Teo Ava          | Sprint 2 | Listo  |
| FT1-20 | ADR - Flujo obligatorio de membresía y pago                                | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-21 | ADR - Cálculo de montos server-side                                        | Teo Ava          | Sprint 2 | Listo  |
| FT1-22 | ADR - Sistema de auditoría en dos capas                                    | Máximo Retamoso  | Sprint 2 | Listo  |
| FT1-35 | TypeORM + PostgreSQL (Supabase) y entidades                                | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-36 | M1 Usuarios y Membresías (RF-01, RF-02, RF-03)                             | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-37 | M2 Gimnasio y Acceso: QR, validación, egreso y aforo (RF-04, RF-05, RN-01) | Máximo Retamoso  | Sprint 2 | Listo  |
| FT1-38 | M3 Clases Grupales (RF-06, RF-07)                                          | Teo Ava          | Sprint 2 | Listo  |
| FT1-39 | M4 Canchas: recursos, reservas y mantenimiento (RF-09, RF-10, RF-12)       | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-40 | M5 Pagos: pasarela mock y comprobante PDF (RF-13, RF-14, RNF-02)           | Máximo Retamoso  | Sprint 2 | Listo  |
| FT1-41 | Autenticación JWT, roles y alcance por sede                                | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-42 | Módulo de soporte: sedes, franjas, precios e instructores (RNF-04)         | Máximo Retamoso  | Sprint 2 | Listo  |
| FT1-43 | Scripts SQL: esquema base y trigger de auditoría                           | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-50 | Crear nuevo rol Gerente de Sede                                            | Máximo Retamoso  | Sprint 4 | Listo  |
| FT1-51 | Subtarea: Endpoints                                                        | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-52 | Subtarea: Modificar BD                                                     | Teo Ava          | Sprint 4 | Listo  |
| FT1-53 | Subtarea: Nuevas pantallas                                                 | Máximo Retamoso  | Sprint 4 | Listo  |
| FT1-70 | Primera versión del cobro en efectivo en mostrador                         | Teo Ava          | Sprint 2 | Listo  |
| FT1-71 | Corrección del límite de intentos de login                                 | Teo Ava          | Sprint 2 | Listo  |
| FT1-72 | Alcance por sede fail-closed en membresías y pagos                         | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-73 | Clases como plantillas recurrentes (ADR-018)                               | Martín Zanandrea | Sprint 2 | Listo  |
| FT1-74 | Paginación en los listados de la API                                       | Martín Zanandrea | Sprint 2 | Listo  |

### FT1-3 — Unidad III — Patrones (Listo)

| Clave  | Historia o subtarea                                     | Responsable      | Sprint   | Estado |
| ------ | ------------------------------------------------------- | ---------------- | -------- | ------ |
| FT1-23 | Patrón Strategy para precio dinámico de canchas (RF-11) | Martín Zanandrea | Sprint 3 | Listo  |
| FT1-24 | Patrón Observer para lista de espera (RF-08)            | Martín Zanandrea | Sprint 3 | Listo  |
| FT1-25 | Patrón Repository con control de concurrencia (RN-02)   | Martín Zanandrea | Sprint 3 | Listo  |
| FT1-26 | Justificación escrita de los patrones de diseño         | Máximo Retamoso  | Sprint 3 | Listo  |
| FT1-75 | Cambio de contraseña                                    | Martín Zanandrea | Sprint 3 | Listo  |

### FT1-4 — Unidad IV — Componentes (Listo)

| Clave  | Historia o subtarea                                                 | Responsable      | Sprint   | Estado |
| ------ | ------------------------------------------------------------------- | ---------------- | -------- | ------ |
| FT1-28 | Estado global y comunicación entre componentes                      | Teo Ava          | Sprint 4 | Listo  |
| FT1-32 | Reorganizar componentes con Atomic Design                           | Máximo Retamoso  | Sprint 4 | Listo  |
| FT1-34 | Capa de servicio frontend (consumo de la API)                       | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-45 | Pantallas de administración (Gerente y Recepcionista)               | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-47 | Pantallas del socio/cliente                                         | Teo Ava          | Sprint 4 | Listo  |
| FT1-48 | Pantallas del home/inicio                                           | Máximo Retamoso  | Sprint 4 | Listo  |
| FT1-49 | Componentes base compartidos (ui.tsx)                               | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-76 | Panel de administración: sedes, usuarios y reportes                 | Teo Ava          | Sprint 4 | Listo  |
| FT1-77 | Gestión de reservas de clases y canchas para el gerente             | Teo Ava          | Sprint 4 | Listo  |
| FT1-78 | Verificación de email obligatoria (RF-01)                           | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-79 | Catálogo de tipos de cancha gestionable (RF-09)                     | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-80 | Paso de Externo a Socio al pagar la membresía (ADR-020)             | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-81 | Sesión sincronizada entre pestañas                                  | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-82 | Cobro del recepcionista, personal y clientes                        | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-83 | Notificaciones por panel y email, historial de pagos y comprobantes | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-84 | Correo con proveedor abstracto (Brevo)                              | Martín Zanandrea | Sprint 4 | Listo  |
| FT1-85 | Vigencia de membresías por fechas (ADR-022)                         | Martín Zanandrea | Sprint 4 | Listo  |

### FT1-5 — Unidad V — Testing y CI/CD (Por hacer)

| Clave  | Historia o subtarea                                                        | Responsable      | Sprint     | Estado    |
| ------ | -------------------------------------------------------------------------- | ---------------- | ---------- | --------- |
| FT1-30 | Testing y TDD (pruebas unitarias e integración)                            | Máximo Retamoso  | Sprint 5   | Listo     |
| FT1-57 | Subtarea: Pruebas unitarias del acceso por QR y RN01 (duplicada de FT1-58) | Teo Ava          | Sin sprint | Listo     |
| FT1-31 | Pipeline CI/CD                                                             | Martín Zanandrea | Sprint 5   | Listo     |
| FT1-54 | Pruebas de uso                                                             | Teo Ava          | Sprint 5   | Listo     |
| FT1-55 | Pruebas de seguridad                                                       | Martín Zanandrea | Sprint 5   | En curso  |
| FT1-56 | Reporte de pruebas                                                         | Máximo Retamoso  | Sprint 5   | Listo     |
| FT1-86 | Escaneo de secretos del historial y gitleaks en el CI                      | Máximo Retamoso  | Sprint 5   | Listo     |
| FT1-87 | CI con Node 22                                                             | Martín Zanandrea | Sprint 5   | Listo     |

### FT1-6 — Unidad VI — Móvil (Listo)

| Clave   | Historia o subtarea                                                             | Responsable      | Sprint   | Estado    |
| ------- | ------------------------------------------------------------------------------- | ---------------- | -------- | --------- |
| FT1-88  | Portal como PWA instalable (ADR-011)                                            | Martín Zanandrea | Sprint 6 | Listo     |
| FT1-89  | Notificaciones push con VAPID                                                   | Martín Zanandrea | Sprint 6 | Listo     |
| FT1-90  | Estados sin conexión en el cliente                                              | Martín Zanandrea | Sprint 6 | Listo     |
| FT1-91  | Validación del QR sin conexión en el terminal de sede (RNF-01)                  | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-105 | Subtarea: Claves ES256 del QR y verificación dual (HS256/ES256)                 | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-106 | Subtarea: Migración 012: columnas de acceso offline y tabla de eventos          | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-107 | Subtarea: Endpoints de clave pública y snapshot de la sede                      | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-108 | Subtarea: Endpoint de sincronización de ingresos offline                        | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-109 | Subtarea: Terminal: réplica local, verificación del QR y cola de ingresos       | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-110 | Subtarea: Terminal: integración en la pantalla de control de acceso             | Martín Zanandrea | Sprint 7 | Listo     |
| FT1-111 | Subtarea: Documentación del modo offline (ADR-003, ADR-007, secuencia y manual) | Martín Zanandrea | Sprint 7 | Listo     |

### FT1-7 — Cierre — Demo Day (Por hacer)

| Clave   | Historia o subtarea                                                                       | Responsable      | Sprint     | Estado    |
| ------- | ----------------------------------------------------------------------------------------- | ---------------- | ---------- | --------- |
| FT1-92  | Ingreso manual por DNI                                                                    | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-93  | Reestructura a backend/frontend                                                           | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-94  | Contrato OpenAPI exportado (swagger.json)                                                 | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-95  | Migraciones reproducibles con reversión                                                   | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-96  | Datos de prueba con 25 sedes                                                              | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-97  | Docker compose y almacenamiento local de archivos                                         | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-98  | Los diez ADR obligatorios en la plantilla del Anexo B                                     | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-99  | Diagramas C4, DER, despliegue y pipeline                                                  | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-100 | Corrección de la carga de clases (429 con 25 sedes)                                       | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-101 | Plazos de cancelación iguales a los del servidor                                          | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-102 | Manuales de usuario, de instalación y técnico                                             | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-103 | README con los seis puntos de la cátedra                                                  | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-104 | Integración con la reestructura                                                           | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-112 | Planificación del proyecto: exportar Jira y armar Planificacion.pdf                       | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-113 | Bitácora individual de Martín Zanandrea                                                   | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-114 | Bitácora individual de Teo Ava                                                            | Teo Ava          | Sprint 7   | Listo     |
| FT1-115 | Bitácora individual de Máximo Retamoso: completar y verificar hashes                      | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-116 | Diagramas faltantes: clases, secuencia, estados y actividad                               | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-117 | Evidencia de requisitos no funcionales en docs/rnf                                        | Máximo Retamoso  | Sprint 7   | Por hacer |
| FT1-118 | Verificar docker compose up desde cero y agregar smoke test en el CI                      | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-120 | Cierre de entrega: checklist del Anexo G, tag v1.0-entrega y subida a Moodle              | Martín Zanandrea | Sprint 7   | Por hacer |
| FT1-121 | Restaurar Supabase, verificar el backend en Render y monitor de actividad                 | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-122 | Auditoría (@Auditable) de acciones sensibles                                              | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-123 | Actualizar dependencias vulnerables del backend (npm audit)                               | Martín Zanandrea | Sprint 7   | Listo     |
| FT1-124 | Actualizar dependencias vulnerables del frontend (npm audit)                              | Teo Ava          | Sprint 7   | Listo     |
| FT1-125 | CI: ejecutar las pruebas del frontend (Vitest)                                            | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-126 | Protección de main con checks obligatorios y colaboradora de solo lectura para la cátedra | Martín Zanandrea | Sprint 7   | Por hacer |
| FT1-127 | README: roles, declaración de IA y bibliotecas, credenciales del seed                     | Máximo Retamoso  | Sprint 7   | Por hacer |
| FT1-128 | Actualizar documentación obsoleta (manual de instalación, informe histórico)              | Máximo Retamoso  | Sprint 7   | Listo     |
| FT1-129 | Segunda ronda de auditoría contra el Anexo G                                              | Máximo Retamoso  | Sprint 7   | Por hacer |
| FT1-130 | Prueba de punta a punta del modo offline en producción y su evidencia                     | Martín Zanandrea | Sprint 7   | En curso  |
| FT1-131 | Estructura del frontend frente al punto 4: verificar y documentar                         | Teo Ava          | Sprint 7   | Listo     |
| FT1-132 | Lint: errores del frontend y saltos de línea del backend                                  | Teo Ava          | Sprint 7   | Listo     |
| FT1-133 | Preparación de la defensa: demo, plan B y escenario de canchas de tenis                   | Martín Zanandrea | Sin sprint | Por hacer |

### Historias sin épica asignada

| Clave  | Historia                                                     | Responsable      | Sprint   | Estado    |
| ------ | ------------------------------------------------------------ | ---------------- | -------- | --------- |
| FT1-58 | Pruebas unitarias del acceso por QR y RN01                   | Teo Ava          | Sprint 5 | Listo     |
| FT1-59 | Pruebas de integración contra PostgreSQL real (RN01 y RN02)  | Máximo Retamoso  | Sprint 5 | Listo     |
| FT1-60 | Pruebas de autenticación y estrategia JWT                    | Martín Zanandrea | Sprint 5 | Listo     |
| FT1-61 | Checklist de pruebas en producción por rol                   | Máximo Retamoso  | Sprint 5 | Listo     |
| FT1-62 | Reporte de QA y corrección de hallazgos                      | Máximo Retamoso  | Sprint 5 | Listo     |
| FT1-63 | Auditoría de roles y alcance por sede (prueba automática)    | Martín Zanandrea | Sprint 5 | Listo     |
| FT1-64 | Corregir error 500 en ingresos simultáneos y endurecer el QR | Máximo Retamoso  | Sprint 5 | Listo     |
| FT1-65 | Informe de auditoría del testing y cobertura                 | Teo Ava          | Sprint 5 | Listo     |
| FT1-66 | Informe de cobertura generado en cada ejecución del CI       | Martín Zanandrea | Sprint 5 | Listo     |
| FT1-67 | Workflow de GitHub Actions (tsc, pruebas, build)             | Martín Zanandrea | Sprint 5 | Listo     |
| FT1-68 | Despliegue del backend condicionado al CI (Render)           | Martín Zanandrea | Sprint 5 | Listo     |
| FT1-69 | Pruebas unitarias con Vitest                                 | Martín Zanandrea | Sprint 5 | Listo     |

## 5. Cronograma

| Sprint   | Fechas (Jira) | Objetivo                                                                 | Entregable de cierre                                   | Estado en Jira |
| -------- | ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ | -------------- |
| Sprint 1 | 13/08 – 27/08 | Arquitectura base: monolito modular, PostgreSQL y C4 en tres niveles     | Documento de arquitectura: C4 y ADR fundacionales      | Cerrado        |
| Sprint 2 | 03/09 – 17/09 | Scaffolding NestJS + TypeORM, esquema de base de datos y primera API     | API base de los módulos M1 a M5 con Swagger            | Cerrado        |
| Sprint 3 | 15/09 – 24/09 | Patrones Strategy, Observer y Repository con control de concurrencia     | Patrones implementados y justificados                  | Cerrado        |
| Sprint 4 | 15/09 – 08/10 | Frontend con componentes, estado global y pantallas por rol              | Portal del socio y consola de administración           | Cerrado        |
| Sprint 5 | 09/10 – 22/10 | Pruebas unitarias e integración, CI/CD y Docker                          | Pipeline operativo, cobertura sobre el umbral, compose | Activo         |
| Sprint 6 | 23/10 – 05/11 | Acceso móvil sin conexión (PWA)                                          | Portal instalable y notificaciones push                | Futuro en Jira |
| Sprint 7 | 06/11 – 19/11 | Integración final y cierre (acceso offline, reestructura, documentación) | Repositorio unificado, manuales, ADR y diagramas       | Futuro en Jira |
| Sprint 8 | 23/11 – 29/11 | Demo Day y defensa técnica                                               | Demo funcional y defensa                               | Futuro en Jira |

Capacidad comprometida: el tablero no registra capacidad ni horas. Las fechas de los sprints 5 a 8 se ordenaron el 09/11/2026 para que no se superpongan; las de los sprints 1 a 4 son las registradas al abrirlos, y el sprint 1 figura dos veces en Jira (identificadores 1 y 11, mismo contenido). La semana 16 (23/11 a 29/11) corresponde al Demo Day.

_Figura 1. Diagrama de Gantt: ver Planificacion.pdf (la figura se genera en el PDF)._

## 6. Asignación y carga

Cantidad de tarjetas (historias y subtareas, sin épicas) por integrante y sprint, y estado actual. El tablero no registra horas, por lo que la carga se mide en tarjetas.

| Integrante       | S1  | S2  | S3  | S4  | S5  | S6  | S7  | Sin sprint | Total |
| ---------------- | --- | --- | --- | --- | --- | --- | --- | ---------- | ----- |
| Martín Zanandrea | 1   | 11  | 4   | 12  | 9   | 3   | 19  | 1          | 60    |
| Teo Ava          | 1   | 6   | 0   | 5   | 3   | 0   | 4   | 0          | 19    |
| Máximo Retamoso  | 2   | 5   | 1   | 4   | 7   | 0   | 18  | 0          | 37    |
| Sin asignar      | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 1          | 1     |

Desbalance visible: de 117 tarjetas sin contar épicas, Martín Zanandrea tiene 60, Máximo Retamoso 37, Teo Ava 19 y 1 no tienen responsable.

| Integrante       | Listo | En curso | Por hacer |
| ---------------- | ----- | -------- | --------- |
| Martín Zanandrea | 46    | 2        | 12        |
| Teo Ava          | 15    | 0        | 4         |
| Máximo Retamoso  | 30    | 0        | 7         |

## 7. Matriz de trazabilidad

Requisito, historia que lo implementa (según el título de la tarjeta de Jira) y prueba que lo verifica. El detalle por archivo de prueba está en docs/PRUEBAS.md y en las carpetas test y \*.spec.ts de cada módulo.

| Requisito | Historia                | Prueba que lo verifica                                                                                                            |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| RF-01     | FT1-36, FT1-78          | Pruebas unitarias del módulo de usuarios y verificación de email                                                                  |
| RF-02     | FT1-36, FT1-85          | Pruebas unitarias de membresías y de vigencia (consumidores-vigencia)                                                             |
| RF-03     | FT1-36, FT1-37          | Pruebas de acceso multi-sede; integración de RN-01 contra PostgreSQL                                                              |
| RF-04     | FT1-37, FT1-91, FT1-92  | acceso.service.spec.ts, acceso-dni.spec.ts, acceso-offline.spec.ts, acceso-sincronizacion.spec.ts e integración de sincronización |
| RF-05     | FT1-37                  | Pruebas unitarias del servicio de acceso (aforo por sede)                                                                         |
| RF-06     | FT1-38, FT1-73          | Pruebas unitarias del módulo de clases                                                                                            |
| RF-07     | FT1-38, FT1-101         | Pruebas unitarias del módulo de clases (reserva y cancelación)                                                                    |
| RF-08     | FT1-24                  | Pruebas unitarias del patrón Observer de la lista de espera                                                                       |
| RF-09     | FT1-39, FT1-79          | Pruebas unitarias del módulo de canchas                                                                                           |
| RF-10     | FT1-39                  | Pruebas unitarias del módulo de canchas (reservas y cancelación)                                                                  |
| RF-11     | FT1-23                  | Pruebas unitarias de las estrategias de precio (PricingStrategy)                                                                  |
| RF-12     | FT1-39                  | Pruebas unitarias del módulo de canchas (mantenimiento)                                                                           |
| RF-13     | FT1-40, FT1-70, FT1-82  | Pruebas unitarias del módulo de pagos                                                                                             |
| RF-14     | FT1-40, FT1-83          | Pruebas unitarias del módulo de pagos (comprobantes)                                                                              |
| RN-01     | FT1-37, FT1-59          | acceso-rn01.int-spec.ts: integración contra PostgreSQL real (FT1-59)                                                              |
| RN-02     | FT1-25, FT1-59          | Pruebas de integración contra PostgreSQL real (FT1-59)                                                                            |
| RN-03     | FT1-23, FT1-85          | Pruebas unitarias de precio y de vigencia de membresías                                                                           |
| RNF-01    | FT1-90, FT1-91, FT1-130 | Pruebas de verificación ES256, cola y sincronización (backend y frontend); prueba de punta a punta en FT1-130                     |
| RNF-02    | FT1-40                  | Pasarela simulada con token; no se persisten datos de tarjeta                                                                     |
| RNF-03    | FT1-43                  | Índices del esquema SQL; evidencia en docs/rnf (FT1-117)                                                                          |
| RNF-04    | FT1-42, FT1-95, FT1-96  | Alta de sede por configuración en base de datos; datos de prueba con 25 sedes                                                     |

## 8. Seguimiento por sprint

El tablero no registra estimaciones ni horas trabajadas, por lo que no puede calcularse el desvío en horas. Se muestra lo que sí existe: tarjetas asignadas al sprint (sin épicas) y su estado actual.

| Sprint   | Asignadas | Completadas | Trabajado (h) | Desvío                    | Observación                                                                 |
| -------- | --------- | ----------- | ------------- | ------------------------- | --------------------------------------------------------------------------- |
| Sprint 1 | 4         | 4           | No registrado | Sin desvío                | Cerrado                                                                     |
| Sprint 2 | 22        | 22          | No registrado | Sin desvío                | Cerrado                                                                     |
| Sprint 3 | 5         | 5           | No registrado | Sin desvío                | Cerrado                                                                     |
| Sprint 4 | 21        | 21          | No registrado | Sin desvío                | Cerrado                                                                     |
| Sprint 5 | 19        | 18          | No registrado | 1 tarjeta sin completar   | Activo; pendiente la prueba de seguridad (FT1-55)                           |
| Sprint 6 | 3         | 3           | No registrado | Sin desvío                | Alcance móvil sin conexión (PWA)                                            |
| Sprint 7 | 41        | 35          | No registrado | 6 tarjetas sin completar  | Concentra la integración y el cierre; incluye las tarjetas creadas el 09/11 |

Velocidad: los sprints 2 y 4 concentran la mayor cantidad de tarjetas completadas; el sprint 7 acumula el trabajo de integración y documentación de cierre.

## 9. Registro de riesgos

Registro elaborado el 09/11/2026 a partir de lo ocurrido; no se llevó actualizado durante el cuatrimestre.

| Riesgo                                                                   | Prob. | Impacto | Mitigación                                                                                             | Qué ocurrió                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ----- | ------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrencia en reservas se resuelve tarde                               | Media | Alto    | Patrón Repository con control de concurrencia en el sprint 3 (FT1-25) y pruebas contra PostgreSQL real | Se implementó en el sprint 3 y se verificó con pruebas de integración en el sprint 5 (FT1-59).                                                                                                                                               |
| Concentración de la carga en pocos integrantes                           | Alta  | Alto    | Repartir tarjetas por módulo                                                                           | Se materializó: ver sección 6. Un integrante concentra la mayor parte de las tarjetas.                                                                                                                                                       |
| Tablero y planificación no se sostienen durante el cuatrimestre          | Alta  | Alto    | Actualizar Jira al cierre de cada sprint                                                               | Se materializó: 48 tarjetas se crearon de forma retroactiva para registrar trabajo ya hecho (13 el 29/10 y 35 el 09/11 a las 17:58); otras 29 del 09/11 son planificación de cierre y brechas de la auditoría. No hay estimaciones ni horas. |
| Acceso sin conexión (RNF-01) no se prueba de punta a punta               | Alta  | Alto    | Diseño con QR firmado ES256, réplica local, cola y sincronización; desglose en FT1-105 a FT1-111       | La implementación se completó el 09/11. La prueba de punta a punta en producción está planificada en FT1-130.                                                                                                                                |
| Vulnerabilidades de seguridad en el acceso por QR                        | Media | Alto    | Pruebas de seguridad y endurecimiento del QR (FT1-64)                                                  | Se corrigió el error 500 en ingresos simultáneos y el uso del QR como token de sesión; se rechaza el payload de tipo qr-acceso en la estrategia JWT.                                                                                         |
| Cambios de versión rompen el CI                                          | Media | Medio   | Integración continua con pruebas y compilación                                                         | El CI falló porque supabase-js exige WebSocket nativo (Node 22); se actualizó el CI, los Dockerfiles y engines a Node 22 (FT1-87).                                                                                                           |
| Pérdida de conexión del backend desplegado con la base de datos gratuita | Media | Alto    | Despliegue condicionado al CI y verificación manual en producción                                      | El backend en Render dejó de conectarse a Supabase. Se verificó el proyecto el 09/11 y el despliegue volvió a funcionar; se creó FT1-121 para un monitor de actividad.                                                                       |
| Esquema de producción divergente de las migraciones                      | Media | Medio   | Migraciones con reversión y job de integración en el CI                                                | La tabla schema_migraciones de producción estaba vacía; la migración 012 se aplicó a mano dentro de una transacción el 09/11.                                                                                                                |

## 10. Análisis de desvíos

1. ¿Dónde se estimó mal y por qué? No se registraron estimaciones, de modo que el desvío no puede medirse en horas; ese es el primer desvío. Los datos del tablero muestran qué no se había visto: la carga documental (ADR, diagramas, manuales, bitácoras y planificación) quedó para el sprint de cierre, en lugar de producirse sprint a sprint, y el sprint 7 acumula 41 tarjetas frente a 3 del sprint 6.

2. ¿Qué riesgo se materializó y cómo se absorbió? Se materializó la planificación no sostenida, sin absorber: el tablero se completó al cierre y su estado se declara en este documento. Se absorbieron el fallo del CI por la versión de Node (se subió a Node 22), la pérdida de conexión del backend con la base (se verificó el proyecto y se abrió un monitor) y las fallas del acceso por QR (se endureció y se reescribió la validación con firma ES256 para el modo sin conexión).

3. ¿Qué se replanificaría si el proyecto empezara de nuevo el lunes? Se mantendría el tablero vivo desde el sprint 1, con estimación en puntos y horas registradas por tarjeta y fecha de cierre. Se escribirían los ADR, los diagramas y las bitácoras al cierre de cada sprint y no al final. Se repartiría la carga con un tope visible por integrante y revisión en cada sprint. Se priorizaría el acceso sin conexión (RNF-01) y su prueba de punta a punta antes del sprint de integración, y se instalaría desde el principio un monitor y un respaldo de la infraestructura.

## 11. Referencias

- Equipo 08. (2026). Tablero FT1 FitZoneSports1 [Registro de proyecto]. Jira. https://fitzone-sports.atlassian.net
- Universidad Nacional de Entre Ríos, Facultad de Ciencias de la Administración. (2026a). Trabajo integrador final: Caso FitZone Sports [Enunciado]. Programación V.
- Universidad Nacional de Entre Ríos, Facultad de Ciencias de la Administración. (2026b). Lineamientos de entrega del TIF FitZone Sports, 2.º cuatrimestre 2026 [Documento de cátedra]. Programación V.
