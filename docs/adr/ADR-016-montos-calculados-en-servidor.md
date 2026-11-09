# ADR-016 — Cálculo de montos de pago exclusivamente en el servidor

- **Estado:** Aceptado
- **Fecha:** 2026-09-06
- **Autor:** Ava, Teo
- **Sprint:** 2

## Contexto

El flujo de pago recibía el monto directamente del cliente para membresías, reservas de clase y reservas de cancha, sin validarlo contra ninguna fuente de verdad del backend, lo que permitía manipular el monto efectivamente pagado. Tampoco existía una forma de que el Gerente modificara el precio de los planes de membresía sin desplegar código nuevo.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Tabla de precios + recálculo en el servidor** | El cliente no puede manipular el monto; el gerente edita precios sin desplegar | Una tabla más | Elegida |
| Confiar en el monto del cliente | Simple | Permite pagar lo que el cliente quiera | Vulnerabilidad |
| Precios en constantes del código | Sin tabla | Cambiar un precio exige desplegar | Poco operable |

## Decisión

Vamos a usar una tabla de precios de membresía, editable exclusivamente por el rol Gerente, como fuente de verdad del precio de cada plan, y recalcular siempre el monto real del lado del servidor: desde esa tabla para membresías, y desde el precio final ya calculado y persistido al momento de reservar para las canchas, ignorando cualquier monto que envíe el cliente en ambos casos.

## Consecuencias

- **Positivas:** cierra la manipulación de montos; precios editables por el gerente.
- **Negativas:** los precios de canchas se toman del valor persistido al reservar.
- **Deuda asumida:** ninguna relevante.

## Requisitos relacionados

RF-02, RF-11, RF-13

## Detalle de las consecuencias

Cierra el vector de manipulación de precios en membresías y canchas: el monto pagado ya no depende de lo que declare el cliente. El Gerente puede modificar el precio de los planes desde la aplicación, sin necesidad de un nuevo despliegue. Las clases no son cobrables de forma independiente porque el acceso viene incluido en la membresía (RN-03).

> Originalmente ADR 0007 (FT1-21). Contenido sin cambios, adaptado a la plantilla del Anexo B.
