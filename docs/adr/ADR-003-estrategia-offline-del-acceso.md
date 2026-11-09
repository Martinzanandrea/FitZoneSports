# ADR-003 — Estrategia offline del control de acceso

- **Estado:** Propuesto
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

RNF-01 exige que el control de acceso funcione aunque se caiga la conexión principal a internet (disponibilidad de 99,5 %). Hoy el QR del socio es un JWT firmado con el secreto del servidor (HS256) que rota cada 60 segundos (RF-04) y se valida solo con un `POST /acceso/validar` al servidor central. La tabla `control_acceso` ya tiene las columnas `validado_offline` y `sincronizado_en`, pero ningún código las usa: sin conexión, la pantalla de recepción bloquea la validación. Para validar en la sede sin el servidor, el terminal necesita poder verificar la firma del QR y saber si la membresía está vigente, sin conocer el secreto de firma.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **QR firmado con clave asimétrica + copia local de socios vigentes** | El terminal verifica la firma con la clave pública, sin secreto; funciona sin red; RN-01 se re-verifica al sincronizar | Hay que distribuir la clave pública y una lista de vigencias a cada terminal; ventana de inconsistencia mientras dura la caída | Propuesta |
| Mantener el QR con HS256 y copiar el secreto al terminal | Cambio mínimo en el servidor | Un terminal comprometido permitiría generar QR válidos para cualquiera | Riesgo de seguridad inaceptable |
| Validación manual con lista impresa o DNI | Sin desarrollo | No hay registro automático; RN-01 imposible de controlar | No cumple RNF-01 de forma verificable |
| Conexión de respaldo (4G) en cada sede | Sin cambios de software | Costo de infraestructura; no cubre la caída del servidor central | No resuelve la caída del backend |

## Decisión

Se propone: (1) firmar el QR con **ES256** (clave privada solo en el servidor; la clave pública se publica en `GET /acceso/clave-publica`); (2) que el terminal de sede (la pantalla de recepción instalada como PWA, ver ADR-011) guarde en IndexedDB la clave pública y la lista de socios con membresía vigente, con su fecha de fin; (3) que sin conexión el terminal verifique firma, vencimiento del token y vigencia local, registre el ingreso en una cola local marcado `validado_offline = true` y lo envíe al reconectar (ver ADR-007). El criterio es que la validación offline no puede requerir ningún secreto en la sede.

## Consecuencias

- **Positivas:** el acceso sigue funcionando con el servidor central caído; la seguridad del QR no depende de los terminales.
- **Negativas:** durante la caída RN-01 no se puede garantizar entre sedes (cada terminal solo conoce sus propios ingresos); se resuelve al sincronizar, con el conflicto registrado.
- **Deuda asumida:** **no implementado a la fecha de este ADR.** Implementarlo es requisito para cumplir RNF-01 y el punto 4 de la funcionalidad mínima exigible. Si no se implementa antes de la entrega, el equipo debe declararlo en el plan como alcance no cumplido e informarlo a la cátedra antes del 19/11 (punto 7.2 de los lineamientos).

## Requisitos relacionados

RNF-01, RF-04, RN-01
