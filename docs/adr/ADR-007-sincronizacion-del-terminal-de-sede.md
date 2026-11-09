# ADR-007 — Sincronización del terminal de sede con el servidor central

- **Estado:** Propuesto (implementación en curso a cargo de Zanandrea, Martín; pasar a Aceptado al integrarla y ajustar la decisión a lo implementado)
- **Fecha:** 2026-11-09
- **Autor:** Retamoso, Máximo
- **Sprint:** 7

## Contexto

Si el terminal de sede valida ingresos sin conexión (ADR-003), necesita una copia local de los datos para decidir y una forma de devolver al servidor lo que pasó durante la caída. Hay que definir qué se replica, cada cuánto y qué hacer cuando lo registrado offline choca con el estado central (por ejemplo, el mismo socio ingresó en otra sede mientras esta estaba desconectada: RN-01).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **Réplica mínima por sede + cola de ingresos con resolución en el servidor** | Datos chicos (id, nombre, fin de vigencia); el servidor decide los conflictos con toda la información | Ventana de datos desactualizados igual al intervalo de refresco | Propuesta |
| Réplica completa de la base en cada sede | El terminal sabe todo | Volumen innecesario y datos personales replicados en 25 sedes | Desproporcionado y riesgoso |
| Base local con replicación bidireccional (CouchDB/PouchDB) | Sincronización resuelta por la herramienta | Otra base y otro modelo de datos solo para el terminal | Agrega una pieza de infraestructura para un caso acotado |

## Decisión

Se propone: **qué se replica:** clave pública de firma del QR y, por socio con membresía vigente o próxima, `usuarioId`, nombre y `fecha_fin`; **frecuencia:** al iniciar el terminal y cada 5 minutos con conexión, más un refresco al reconectar; **cola:** cada ingreso offline se guarda con un identificador generado en el terminal (idempotencia) y la hora local; **conflictos al reconectar:** el servidor procesa la cola en orden; si el socio ya tenía una sesión abierta en otra sede, el ingreso se registra igual (la persona entró físicamente) marcado como conflicto RN-01 y se notifica a la gerencia; los reintentos con el mismo identificador no duplican.

## Consecuencias

- **Positivas:** RN-01 queda auditada aunque no se pueda impedir durante la caída; el servidor sigue siendo la fuente de verdad.
- **Negativas:** un socio dado de baja durante la caída puede ingresar hasta el próximo refresco; hay que guardar datos personales mínimos en el dispositivo.
- **Deuda asumida:** **no implementado.** Depende de ADR-003 y comparte su estado.

## Requisitos relacionados

RNF-01, RN-01, RF-04
