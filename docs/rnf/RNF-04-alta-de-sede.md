# RNF-04 — Alta de una sede nueva sin detener el sistema

**Requisito (ADR-001):** se puede dar de alta una sede nueva sin detener el sistema.

**Estado de la evidencia:** diseño y datos de prueba verificados; **la verificación en ejecución (alta con el sistema en marcha) no se corrió**, por el mismo corte de la base temporal descrito en [RNF-03](RNF-03-latencia.md). No se declara como pasada.

## 1. Evidencia existente

- **Las sedes son datos, no configuración.** Se crean por API (`POST /sedes`, solo gerente general, `backend/src/sedes/sedes.controller.ts`) y se les agregan franjas horarias (`POST /sedes/:id/franjas`). No requiere reiniciar ni desplegar (manual de instalación y operación, sección 9).
- **Seed de 25 sedes.** `backend/db/seed/datos-prueba.sql` carga 25 sedes con su gerente, su recepcionista, cuatro socios y un cliente externo. Al cargarlo sobre una base creada desde cero con las migraciones del repositorio (11/11/2026), el comando `node db/migrar.js seed` informó «Datos de prueba cargados: 25 sedes».
- Los socios de cualquier sede pueden ingresar en una sede nueva (manual de instalación y operación, sección 9, paso 4).

## 2. Verificación en ejecución (pendiente)

El script `medicion/verificar-alta-sede.mjs` da de alta una sede y su franja con la API en marcha, mientras una sonda consulta `GET /canchas/publico` cada 100 ms, y comprueba que la sede aparece en el listado y que una sesión iniciada antes del alta sigue válida. Escribe una sede en la base: exige `--base-de-prueba` y una API local.

```bash
node docs/rnf/medicion/verificar-alta-sede.mjs --api http://localhost:3000 --base-de-prueba
```

Guarda `medicion/resultado-alta-sede-AAAA-MM-DD.json`. Cuando exista ese archivo, el Dossier lo cita automáticamente.

### Registro de la ejecución (completar al correrlo)

| Dato | Valor |
|---|---|
| Fecha y quién ejecutó | |
| Commit probado | |
| ☐ Alta de sede y franja con código 201 | |
| ☐ Sonda sin fallos durante el alta | |
| ☐ La sede aparece en el listado | |
| ☐ La sesión previa sigue válida | |
