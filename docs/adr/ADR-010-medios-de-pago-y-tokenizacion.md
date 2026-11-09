# ADR-010 — Tratamiento de los medios de pago: pasarela simulada, tokenización y sin datos de tarjeta

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Zanandrea, Martín
- **Sprint:** 2

## Contexto

RF-13 pide integrar una pasarela de pago simulada (Mercado Pago o MODO) y RNF-02 exige que los datos de tarjeta no se almacenen localmente: solo el token de la pasarela. Además el recepcionista cobra en efectivo en el mostrador, sin pasarela. El monto nunca debía depender de lo que envía el cliente (ver ADR-016).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Interfaz `PasarelaPago` con implementación simulada; solo se guarda el token** | La tarjeta nunca toca nuestro servidor ni la base; cambiar a una pasarela real es otra implementación | La pasarela simulada no prueba los casos reales de una pasarela (webhooks, pagos pendientes) | Elegida |
| Formulario propio de tarjeta que envía los datos a la API | Control total de la interfaz | Los datos de tarjeta pasarían por el servidor: alcance PCI-DSS completo | Viola RNF-02 |
| Guardar la tarjeta cifrada para cobros recurrentes | Renovación automática real | Custodia de datos de tarjeta, aunque estén cifrados | Viola RNF-02; la renovación se simula |

## Decisión

Los pagos online pasan por la interfaz `PasarelaPago` (`backend/src/pagos/pasarela-pago.interface.ts`), implementada por `PasarelaMockService`, que devuelve `{ aprobado, token }` con un token opaco `MOCK-<método>-…`. La tabla `pagos` guarda solo método, monto, estado y `token_pasarela`: **no existe ningún campo de número de tarjeta, vencimiento ni código de seguridad**. Una restricción CHECK (exclusive arc) obliga a que un pago EFECTIVO tenga `registrado_por_id` y no token, y uno MERCADOPAGO/MODO tenga token y no `registrado_por_id`. El monto se calcula siempre en el servidor (ADR-016) y cada pago aprobado genera su comprobante PDF (RF-14).

## Consecuencias

- **Positivas:** RNF-02 se cumple por construcción: no hay dónde guardar una tarjeta; integrar Mercado Pago real es agregar otra implementación de la interfaz.
- **Negativas:** la simulación aprueba siempre salvo que se fuerce el rechazo; no se modelan pagos pendientes ni notificaciones asíncronas de la pasarela.
- **Deuda asumida:** con una pasarela real habría que agregar el webhook de confirmación y el estado PENDIENTE que hoy no se usa.

## Requisitos relacionados

RF-13, RF-14, RNF-02
