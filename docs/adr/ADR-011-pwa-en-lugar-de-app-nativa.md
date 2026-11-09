# ADR-011 — Aplicación web progresiva (PWA) en lugar de una app móvil nativa

- **Estado:** Aceptado
- **Fecha:** 2026-10-18
- **Autor:** Zanandrea, Martín
- **Sprint:** 5

## Contexto

El enunciado plantea una app móvil para el socio (mostrar el QR, reservar) y la Unidad VI pide una app instalable con el QR visible. El portal del socio ya era una SPA responsive en React. Construir una app nativa implicaba un segundo cliente con otra base de código y otra capa de servicio, en la parte final del cuatrimestre, y publicar en tiendas requiere cuentas de desarrollador. La PWA se implementó en el commit `8963659` (vite-plugin-pwa) y se completó con notificaciones push (ADR-021 y canal PUSH).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **PWA sobre el mismo portal (vite-plugin-pwa)** | Una sola base de código; instalable en Android, iOS y escritorio; actualizaciones sin tienda; Web Push | En iOS el soporte de push y de almacenamiento es más limitado; sin acceso a APIs nativas avanzadas | Elegida |
| React Native / Expo | App nativa real, reutiliza conocimiento de React | Segundo cliente a mantener; la capa de servicio y los componentes se duplican; publicación en tiendas | Duplica trabajo en el último tramo |
| Flutter | Rendimiento y UI consistentes | Otro lenguaje (Dart) y otra base de código | Costo de aprendizaje |
| Envolver la web con Capacitor o Cordova | APK instalable reutilizando la web | Agrega una capa nativa que mantener sin beneficio funcional sobre la PWA | La PWA ya es instalable |

## Decisión

El portal se distribuye como **PWA**: manifest, iconos, service worker generado con `vite-plugin-pwa`, modo standalone, aviso de actualización, banner sin conexión y Web Push con VAPID para las notificaciones. El criterio determinante fue entregar la experiencia móvil sin duplicar la base de código ni la capa de servicio.

## Consecuencias

- **Positivas:** un solo cliente para socio y personal; la misma URL sirve en el teléfono y en la recepción; el terminal de sede puede ser la propia PWA instalada (base para ADR-003).
- **Negativas:** la API no se cachea (estrategia `NetworkOnly`), así que hoy el QR no se muestra sin conexión; en iOS las notificaciones push requieren instalar la app en la pantalla de inicio.
- **Deuda asumida:** si la cátedra exigiera APK/IPA de tienda, se podría empaquetar la PWA con una TWA (Android) o Capacitor sin reescribir la app.

## Requisitos relacionados

Unidad VI, RF-04, RNF-01
