# ADR 0010: qrcode.react para el renderizado del QR dinámico en el cliente

## Estado

Aceptado

## Contexto

El backend genera el QR dinámico de acceso (RF04) como un JWT firmado con expiración de 60 segundos (`AccesoService.generarQr`). El frontend necesita renderizar ese token como una imagen QR real, escaneable por el dispositivo del recepcionista. Se evaluó dibujar el patrón QR "a mano" (como hizo el generador de diseño usado como referencia visual, con un patrón determinístico basado en hash del string) contra usar una librería especializada que implemente el estándar QR real.

## Decisión

Vamos a usar `qrcode.react` (componente `QRCodeSVG`) para renderizar el JWT del backend como código QR en el cliente, en lugar de cualquier aproximación dibujada a mano.

## Consecuencias

Así se genera un QR real válido según el estándar, con corrección de errores y capacidad correcta para strings largos como un JWT, escaneable por cualquier lector estándar, evitando que el patrón dibujado a mano usado como referencia —que no era un QR legible sino solo una aproximación visual— rompiera la funcionalidad central de RF04. La librería es liviana, sin dependencias de servidor y renderiza client-side como SVG, a costa de sumar una dependencia externa más al bundle, con impacto mínimo por su tamaño reducido. El cumplimiento es verificable en `client/package.json` con la dependencia `qrcode.react` y en `client/src/modules/acceso/pages/MiQr.tsx` donde `<QRCodeSVG value={qrToken} />` recibe directamente el JWT de `GET /acceso/qr/:usuarioId` sin transformación intermedia.
