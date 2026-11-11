# RNF-02 — No se almacenan datos de tarjeta

**Requisito (ADR-010):** los datos de tarjeta no se almacenan localmente; solo el token de la pasarela.

**Estado de la evidencia:** existente y verificable. Cada afirmación indica el archivo o la consulta que la respalda.

## 1. Diseño

- El dominio depende de la interfaz `PasarelaPago` (`backend/src/pagos/pasarela-pago.interface.ts`). Su método `procesarPago(monto, metodo, forzarRechazo?)` recibe **solo** el monto y el método de pago y devuelve `{ aprobado, token }`: no hay parámetro ni campo para número de tarjeta, vencimiento, código de seguridad ni titular.
- La implementación vigente es `PasarelaMockService` (`backend/src/pagos/gateway/pasarela-mock.service.ts`): espera 300 ms, genera un token con la forma `MOCK-<método>-<instante>-<aleatorio>` y aprueba o rechaza. No hay una pasarela real integrada (ADR-010).
- `PagosService` guarda el token en `tokenPasarela` de cada pago (`backend/src/pagos/pagos.service.ts`).

## 2. Verificación en el esquema de la base

Consulta ejecutada el 11/11/2026 sobre una base de prueba creada desde cero con las migraciones y el seed del repositorio (PostgreSQL 18.0):

```sql
-- Columnas de la tabla pagos
SELECT column_name || ':' || data_type FROM information_schema.columns
 WHERE table_name = 'pagos' ORDER BY ordinal_position;

-- Columnas de cualquier tabla que sugieran datos de tarjeta
SELECT table_name || '.' || column_name FROM information_schema.columns
 WHERE table_schema = 'public'
   AND column_name ~* '(tarjeta|card|pan|cvv|cvc|vencimiento_tarjeta|numero_tarjeta|titular)';
```

Resultado de la primera consulta (`pagos`): `id:uuid`, `usuario_id:uuid`, `membresia_id:uuid`, `reserva_clase_id:uuid`, `reserva_cancha_id:uuid`, `metodo:USER-DEFINED`, `monto:numeric`, `token_pasarela:character varying`, `registrado_por_id:uuid`, `estado:USER-DEFINED`, `pagado_en:timestamp with time zone`, `creado_en:timestamp with time zone`.

Resultado de la segunda consulta: **ninguna fila** (ninguna columna del esquema coincide con esos patrones). Los valores del tipo `metodo` son `MERCADOPAGO`, `MODO` y `EFECTIVO`: identifican el medio, no contienen datos de tarjeta.

## 3. Verificación en el código

Búsqueda sin coincidencias en `backend/src`, `backend/db` y `frontend/src` (archivos `.ts`, `.tsx`, `.sql` y `.js`) de `cvv`, `cvc`, `numero_tarjeta`, `card_number`, `titular_tarjeta`, `vencimiento_tarjeta`, `expiry` y la palabra `pan`:

```bash
grep -rniE "cvv|cvc|numero_?tarjeta|card_?number|titular_?tarjeta|vencimiento_?tarjeta|expiry|\bpan\b" \
  backend/src backend/db frontend/src --include=*.ts --include=*.tsx --include=*.sql --include=*.js
```

## 4. Pruebas automatizadas relacionadas

`backend/src/pagos/pasarela-cancha.spec.ts` cubre el pago con pasarela de una reserva de cancha (cobro del precio calculado en el servidor, comprobante, rechazo sin comprobante, pagos simultáneos con un único cobro, reservas de otro usuario). Pruebas de pagos en efectivo y comprobantes: `cobro-efectivo.spec.ts`, `cobro-cancha-presencial.spec.ts`, `cobro-reserva-existente.spec.ts`, `historial-comprobantes.spec.ts`.

## 5. Alcance y límites

La evidencia demuestra que **este sistema no recibe ni guarda** datos de tarjeta. No evalúa a un proveedor de pagos real: cuando se integre Mercado Pago o MODO, habrá que repetir esta verificación sobre esa integración (ADR-010).
