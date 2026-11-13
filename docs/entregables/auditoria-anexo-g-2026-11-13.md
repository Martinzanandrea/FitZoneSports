# Segunda auditoría contra el Anexo G

**Fecha:** 13/11/2026 · **Rama:** `main` · **Commit:** `f8f75fb` · **Alcance:** revisión de solo lectura sobre el repositorio.

Se recorre el checklist de autoevaluación de la sección 8 de los lineamientos, que el Anexo G reproduce en formato imprimible. No se modificó código ni configuración durante la revisión. El objetivo es dejar marcado qué falta antes del tag y de la subida al campus.

## Resumen

| Resultado | Cantidad |
| --- | --- |
| Cumple | 17 |
| Parcial | 5 |
| No cumple | 1 |
| No verificable en esta revisión | 6 |
| **Total** | **29** |

## Checklist

### Repositorio

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| La estructura coincide con el punto 4 | Cumple | `backend/`, `frontend/` y `docs/` con `adr`, `diagramas`, `manuales`, `bitacoras`, `planificacion`, `rnf` y `entregables`. El README documenta la correspondencia. |
| El tag `v1.0-entrega` está creado y empujado | No cumple | No existe ningún tag en el repositorio. Corresponde a FT1-120. |
| El README permite llegar de la clonación a la aplicación funcionando | Cumple | Secciones 1 a 6 en el orden del punto 4.1: qué es, integrantes con rol y usuario de Git, puesta en marcha en tres comandos, usuarios de prueba por rol, tabla de documentos y estado de las pruebas. |

### Código

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| `docker compose up --build` levanta el sistema en una máquina limpia | No verificable | `docker-compose.yml` y los dos `Dockerfile` están. El job `docker` del CI lo levanta en cada push, pero no se ejecutó en esta revisión porque el entorno no tiene Docker. |
| El set de datos carga 25 sedes y los usuarios de los cuatro roles | Cumple | `backend/db/seed/datos-prueba.sql`: arreglo de 25 ciudades de Entre Ríos, canchas, clases y usuarios de Gerente General, Gerente de Sede, Recepcionista, Socio y Externo. |
| La suite de pruebas corre en verde | No verificable | El README declara 848 pruebas en 42 suites del backend y 153 en 7 archivos del frontend, con 73,65 % de sentencias. No se pudo correr porque el entorno no tiene Node ni npm. |
| No hay secretos versionados | Cumple | El CI corre gitleaks sobre todo el historial. Los `.env` de `backend/`, `frontend/` y raíz están ignorados y no aparecen en `git status`. |

### Funcionalidad

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| Los 14 RF son demostrables | Cumple | La sección 7 de la planificación traza cada RF a tarjetas, pruebas y archivos. No se probaron en vivo en esta revisión. |
| Dos reservas simultáneas confirman una sola | Cumple | `backend/test/integracion/reserva-cancha.int-spec.ts`: diez solicitudes para el mismo turno, una confirmada y nueve conflictos. Corre en el job `integracion`. |
| El terminal de sede valida el QR con el servidor central caído | Cumple | `verificarQr.ts`, `colaIngresos.ts`, `ClavesQrService` y `acceso-offline.spec.ts`. La prueba de punta a punta en producción sigue abierta en FT1-130. |
| El socio en mora paga tarifa de externo | Cumple | Trazado en la sección 7 y cubierto por las pruebas de vigencia y de precios. |

### ADR

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| Los obligatorios están, con alternativas y consecuencias | Cumple | 23 ADR en `docs/adr/`, todos con la tabla de alternativas y la sección de consecuencias. |
| Ninguno quedó en estado «Propuesto» sin resolver | Cumple | Todos dicen «Aceptado», salvo ADR-019, que dice «Reemplazado por ADR-021». |

### Diagramas

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| Los obligatorios están, con fuente editable y exportación legible | Cumple | 18 fuentes Mermaid y 18 SVG: 4 de C4, 7 de UML, el DER en cinco vistas, despliegue y pipeline. El C4-4 de código es opcional y no está. |
| Coinciden con el código entregado | Parcial | `docs/diagramas/README.md` documenta la correspondencia de cada vista con sus archivos. No se contrastó diagrama por diagrama en esta ronda. |

### Bitácoras

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| Hay un archivo por cada integrante | Cumple | `LOG-ava.md`, `LOG-retamoso.md` y `LOG-zanandrea.md`. El equipo tiene tres integrantes. |
| Cada uno tiene al menos ocho entradas distribuidas en el tiempo | Cumple | 16, 14 y 20 entradas (`LOG-ava.md`, `LOG-retamoso.md` y `LOG-zanandrea.md`). |
| Las entradas enlazan commits reales | Cumple | Verificado en la revisión de FT1-115: los hashes existen en `main`. |
| No son copias entre sí | Cumple | Cada bitácora tiene sesiones, decisiones y problemas propios. |
| Entradas en los 8 sprints | Parcial | El sprint 8 (Demo Day) todavía no empezó y ninguna bitácora tiene entrada ahí. La de Máximo tampoco tiene sesión propia en el sprint 6. |

### Manuales

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| Los tres están completos | Cumple | Manual de usuario, de instalación y operación, y técnico, con su README e imágenes. |
| El de usuario tiene capturas del sistema entregado | Cumple | `docs/manuales/img/` con las capturas por rol. |
| El técnico resuelve los dos casos de extensión | Cumple | Sección 7: agregar canchas de tenis y agregar una estrategia de precio. |

### Planificación

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| El plan, el cronograma y la matriz de trazabilidad están | Cumple | Secciones 4, 5 y 7 de `docs/planificacion/PLANIFICACION.md`. |
| El seguimiento registra estimado contra trabajado por sprint | Parcial | La sección 8 muestra asignadas y completadas; la columna de horas dice «No registrado» porque Jira no guarda estimaciones ni horas. La limitación está declarada. |
| El análisis de desvíos responde las tres preguntas | Cumple | Sección 10. |
| El tablero muestra actividad distribuida en el cuatrimestre | Parcial | 48 tarjetas se crearon de forma retroactiva para registrar trabajo ya hecho. Está declarado en la sección 7. |

### Campus y defensa

| Verificación | Estado | Evidencia |
| --- | --- | --- |
| El dossier PDF está subido | No verificable | `docs/entregables/PROGV-2026-TIF-Equipo08-Dossier.pdf` existe en el repositorio. La subida al campus no se puede comprobar desde acá. |
| Incluye la URL del repositorio, el tag y el hash del commit | No verificable | El PDF no se pudo abrir en esta revisión. |
| Los integrantes pueden explicar cualquier parte del sistema | No verificable | Depende de la defensa. |
| La demo de cinco minutos está ensayada y cronometrada | No verificable | FT1-133 sigue abierta. |
| Hay plan B ante fallo de conectividad | No verificable | FT1-133 sigue abierta. |

## Pendientes antes del tag

1. **Tag `v1.0-entrega`** (FT1-120): no existe. Se crea después de cerrar el resto y se empuja con el commit final.
2. **Protección de `main` y colaboradora de solo lectura** (FT1-126): no se puede configurar sin permisos de administración del repositorio.
3. **Prueba de punta a punta del modo offline en producción** (FT1-130): el código y las pruebas automáticas están; falta la evidencia en el entorno desplegado.
4. **Pruebas de seguridad** (FT1-55): siguen en curso.
5. **Bitácoras**: el sprint 8 no tiene entradas porque todavía no empezó. El lineamiento 5.1 habla de ocho sprints y de cuatro integrantes; el equipo tiene tres, y el README lo declara.
6. **Dossier**: comprobar que el PDF tenga la URL, el tag y el hash actualizados después de crear el tag.

## Limitaciones de esta revisión

- No se ejecutaron `npm test`, `npm run test:integracion` ni `docker compose up --build`: el entorno no tiene Node, npm ni Docker. La evidencia de las suites es la que declara el README y la que corre el CI.
- No se abrió el dossier PDF. La herramienta de lectura de PDF no está disponible para este modelo.
- No se revisaron las reglas de protección de rama en GitHub, que dependen de la configuración del repositorio.
- No se probó el sistema desplegado en producción.
